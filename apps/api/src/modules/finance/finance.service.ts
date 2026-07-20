import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RefundService } from '../refund/refund.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { Prisma } from '@prisma/client';

/** V4-7 默认容差阈值（元） */
const DEFAULT_TOLERANCE_YUAN = 1;

/** 告警去重：同一 type + 1 小时 */
const ALERT_DEDUP_MS = 60 * 60 * 1000;

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly refundService: RefundService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /**
   * 读取容差阈值（system_configs.tolerance_yuan，无值用默认 1）
   * M1: 走缓存层
   */
  async getToleranceYuan(): Promise<number> {
    const v = await this.systemConfig.getNumber('finance_tolerance_yuan');
    if (v === null) return DEFAULT_TOLERANCE_YUAN;
    return v >= 0 ? v : DEFAULT_TOLERANCE_YUAN;
  }

  /**
   * 设置容差阈值（SUPER_ADMIN）
   */
  async setToleranceYuan(
    yuan: number,
    ctx: { userId: string; ip: string; ua: string },
  ): Promise<{ toleranceYuan: number }> {
    if (!Number.isFinite(yuan) || yuan < 0) {
      throw new Error('tolerance_yuan 必须是非负数');
    }
    await this.systemConfig.setValue('finance_tolerance_yuan', yuan.toString());
    this.logger.log(`财务容差更新: ¥${yuan} by ${ctx.userId}`);
    return { toleranceYuan: yuan };
  }

  /**
   * 财务对账日表：复用 refund.service.getFinanceDailyReport（保持单一来源）
   */
  async getDailyReport(days: number) {
    return this.refundService.getFinanceDailyReport(days);
  }

  /**
   * 多维度对账：日表 + 按通道 + 按商户
   */
  async getMultiDimReport(params: { days?: number; channel?: string; merchantId?: string }) {
    const days = Math.min(Math.max(params.days ?? 7, 1), 90);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    const toleranceYuan = await this.getToleranceYuan();

    const daily = await this.refundService.getFinanceDailyReport(days);

    // 按通道：聚合 payments + refunds
    // 注：Payment 表无 fee 字段，手续费从通道 config 推断为 0
    const paymentGroups = await this.prisma.$queryRaw<
      Array<{ channel: string; amount: number; count: number }>
    >(Prisma.sql`
      SELECT channel,
             COALESCE(SUM(amount), 0) AS amount,
             COUNT(*) AS count
      FROM payments
      WHERE status = 'SUCCESS' AND paidAt >= ${start}
      GROUP BY channel
    `);

    const refundGroups = await this.prisma.$queryRaw<
      Array<{ channel: string; amount: number; count: number }>
    >(Prisma.sql`
      SELECT p.channel AS channel,
             COALESCE(SUM(r.amount), 0) AS amount,
             COUNT(*) AS count
      FROM refunds r
      INNER JOIN payments p ON p.orderId = r.orderId AND p.status = 'SUCCESS'
      WHERE r.status = 'PAID' AND r.paidAt >= ${start}
      GROUP BY p.channel
    `);

    const channelMap = new Map<string, { revenue: number; refund: number }>();
    for (const pg of paymentGroups) {
      channelMap.set(pg.channel, { revenue: Number(pg.amount), refund: 0 });
    }
    for (const rg of refundGroups) {
      const entry = channelMap.get(rg.channel) ?? { revenue: 0, refund: 0 };
      entry.refund = Number(rg.amount);
      channelMap.set(rg.channel, entry);
    }
    const byChannel = Array.from(channelMap.entries()).map(([channel, v]) => ({
      channel,
      revenue: v.revenue.toFixed(2),
      refundAmount: v.refund.toFixed(2),
      fee: '0.00', // 暂未接入通道手续费，未来可从 PaymentChannel.config 读取
      netRevenue: (v.revenue - v.refund).toFixed(2),
    }));

    // 按商户：aggregate orders by merchantId
    const merchantGroups = await this.prisma.$queryRaw<
      Array<{ merchantId: string; merchantName: string; revenue: number; refund: number }>
    >(Prisma.sql`
      SELECT m.id AS merchantId, m.name AS merchantName,
             COALESCE(SUM(CASE WHEN o.status IN ('PAID','DELIVERED','REFUNDED') THEN o.totalAmount ELSE 0 END), 0) AS revenue,
             COALESCE(SUM(CASE WHEN r.status = 'PAID' THEN r.amount ELSE 0 END), 0) AS refund
      FROM merchants m
      LEFT JOIN orders o ON o.merchantId = m.id AND o.paidAt >= ${start}
      LEFT JOIN refunds r ON r.merchantId = m.id AND r.paidAt >= ${start}
      ${params.merchantId ? Prisma.sql`WHERE m.id = ${params.merchantId}` : Prisma.empty}
      GROUP BY m.id, m.name
      HAVING revenue > 0 OR refund > 0
      ORDER BY revenue DESC
    `);
    const byMerchant = merchantGroups.map((mg) => ({
      merchantId: mg.merchantId,
      merchantName: mg.merchantName,
      revenue: Number(mg.revenue).toFixed(2),
      refundAmount: Number(mg.refund).toFixed(2),
      netRevenue: (Number(mg.revenue) - Number(mg.refund)).toFixed(2),
    }));

    return { daily, byChannel, byMerchant, toleranceYuan };
  }

  /**
   * 对账 Job（每小时）
   * 校验：平台总收入 - 总退款 = 商户余额合计 + 提现合计（理论恒等）
   * 不等 → 写 finance_reconciliation_logs + 告警
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runReconciliation(): Promise<void> {
    const toleranceYuan = await this.getToleranceYuan();

    // T+0 实时：以 createdAt 当天为窗口
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [incomeAgg, refundAgg, merchantBalance, withdrawalAgg] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS', paidAt: { gte: todayStart } },
      }),
      this.prisma.refund.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', paidAt: { gte: todayStart } },
      }),
      this.prisma.merchant.aggregate({ _sum: { balance: true, freezeBalance: true } }),
      this.prisma.withdrawal.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalRefund = Number(refundAgg._sum.amount ?? 0);
    const totalMerchantBalance = Number(merchantBalance._sum.balance ?? 0);
    const totalWithdrawal = Number(withdrawalAgg._sum.amount ?? 0);

    // 理论恒等：总收入 - 总退款 = 商户余额合计 + 提现合计
    // （简化版，未冻结部分；实际还应考虑商户冻结余额）
    const expectedBalance = totalIncome - totalRefund;
    const actualBalance = totalMerchantBalance + totalWithdrawal;
    const diff = Math.abs(expectedBalance - actualBalance);

    this.logger.log(
      `对账: 入账 ¥${totalIncome.toFixed(2)} - 退款 ¥${totalRefund.toFixed(2)} = ¥${expectedBalance.toFixed(2)}；实际余额+提现 ¥${actualBalance.toFixed(2)}；差异 ¥${diff.toFixed(2)}`,
    );

    if (diff < toleranceYuan) return; // 在容差内

    const severity = diff < 100 ? 'WARNING' : diff < 1000 ? 'ERROR' : 'CRITICAL';
    await this.recordDiffAndAlert({
      type: 'BALANCE_MISMATCH',
      description:
        `总收入 ¥${totalIncome.toFixed(2)} - 总退款 ¥${totalRefund.toFixed(2)} = ¥${expectedBalance.toFixed(2)}，` +
        `实际商户余额+提现 ¥${actualBalance.toFixed(2)}，差异 ¥${diff.toFixed(2)}（容差 ¥${toleranceYuan}）`,
      diffAmount: new Prisma.Decimal(diff),
      severity,
    });
  }

  /**
   * 写入差异日志 + 告警（1 小时去重）
   */
  private async recordDiffAndAlert(params: {
    type: string;
    description: string;
    diffAmount: Prisma.Decimal;
    severity: string;
  }): Promise<void> {
    // 1h 内同 type 不重复记录
    const recent = await this.prisma.financeReconciliationLog.findFirst({
      where: {
        type: params.type,
        createdAt: { gte: new Date(Date.now() - ALERT_DEDUP_MS) },
      },
      select: { id: true },
    });
    if (recent) return;

    const log = await this.prisma.financeReconciliationLog.create({
      data: {
        snapshotAt: new Date(),
        type: params.type,
        description: params.description,
        diffAmount: params.diffAmount,
        severity: params.severity,
      },
    });

    // 找所有 SUPER_ADMIN
    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null },
      select: { id: true, email: true },
    });

    const title = `🚨 财务对账差异 [${params.severity}]`;
    const content = params.description + `\n\n请前往 /admin/finance/alerts 处理。`;

    for (const admin of admins) {
      await this.prisma.notification
        .create({
          data: {
            recipientUserId: admin.id,
            type: 'SYSTEM',
            title: title.slice(0, 255),
            content: content.slice(0, 65535),
            link: '/admin/finance/alerts',
          },
        })
        .catch((err) => this.logger.error(`对账告警站内信失败: ${(err as Error).message}`));

      if (admin.email) {
        await this.mail
          .send({
            to: admin.email,
            subject: title,
            html: `<pre>${content.replace(/\n/g, '<br>')}</pre>`,
            text: content,
          })
          .catch((err) => this.logger.error(`对账告警邮件失败: ${(err as Error).message}`));
      }
    }

    await this.prisma.financeReconciliationLog.update({
      where: { id: log.id },
      data: { notifiedAt: new Date() },
    });

    this.logger.error(
      `财务对账差异告警: severity=${params.severity} diff=¥${params.diffAmount.toString()} admins=${admins.length}`,
    );
  }

  /**
   * 列出差异日志
   */
  async listAlerts(params: { page?: number; pageSize?: number; resolved?: boolean; severity?: string }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where: Prisma.FinanceReconciliationLogWhereInput = {};
    if (params.resolved !== undefined) where.resolved = params.resolved;
    if (params.severity) where.severity = params.severity;

    const [items, total] = await Promise.all([
      this.prisma.financeReconciliationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.financeReconciliationLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * 标记差异已解决
   */
  async resolveAlert(
    id: string,
    resolutionNote: string,
    ctx: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; resolved: boolean }> {
    await this.prisma.financeReconciliationLog.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: ctx.userId,
        resolutionNote: resolutionNote.slice(0, 2000),
      },
    });
    return { id, resolved: true };
  }

  /**
   * CSV 导出（聚合报告）
   */
  async exportCsv(days: number): Promise<string> {
    const report = await this.getMultiDimReport({ days });
    const lines: string[] = [];
    lines.push('日期,总收入,总退款,净收入,退款率');
    for (const d of report.daily.days) {
      lines.push(`${d.date},${d.revenue},${d.refundAmount},${d.netRevenue},${d.refundRate}%`);
    }
    lines.push('');
    lines.push('按通道');
    lines.push('通道,总收入,总退款,手续费,净收入');
    for (const c of report.byChannel) {
      lines.push(`${c.channel},${c.revenue},${c.refundAmount},${c.fee},${c.netRevenue}`);
    }
    lines.push('');
    lines.push('按商户');
    lines.push('商户ID,商户名,总收入,总退款,净收入');
    for (const m of report.byMerchant) {
      lines.push(`${m.merchantId},${m.merchantName},${m.revenue},${m.refundAmount},${m.netRevenue}`);
    }
    // 加 BOM 让 Excel 正确识别 UTF-8
    return '\ufeff' + lines.join('\n');
  }
}
