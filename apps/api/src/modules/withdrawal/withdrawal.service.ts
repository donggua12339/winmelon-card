import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ConfigService } from '@nestjs/config';
import { NotificationTriggerService } from '../notification/notification-trigger.service';
import { WithdrawalMethod, WithdrawalStatus, Prisma } from '@prisma/client';

/** 平台全局提现配置（可改为 system_configs 动态配置） */
interface PlatformWithdrawConfig {
  minAmount: number; // 最低提现金额（元）
  feePercent: number; // 手续费百分比（0 表示不收）
  feeFixed: number; // 固定手续费（元）
}

const DEFAULT_CONFIG: PlatformWithdrawConfig = {
  minAmount: 10,
  feePercent: 0,
  feeFixed: 0,
};

@Injectable()
export class WithdrawalService {
  private readonly logger = new Logger(WithdrawalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
    private readonly trigger: NotificationTriggerService,
  ) {}

  /** 获取平台提现配置（可后续接入 system_configs 动态配置） */
  async getPlatformConfig(): Promise<PlatformWithdrawConfig> {
    // 暂时硬编码返回，未来从 system_configs 读
    return DEFAULT_CONFIG;
  }

  /**
   * 商户申请提现（T+0 立即可提现）
   * - 校验余额 ≥ 申请金额 + 手续费
   * - 立即从 balance 扣除（避免重复提现）
   * - 写入 Withdrawal 记录（PENDING）
   * - 记录冻结金额（如有）
   */
  async apply(
    merchantId: string,
    payload: { amount: number; method: WithdrawalMethod; accountInfo: Record<string, string> },
    ctx: { userId: string; ip: string; ua: string },
  ) {
    const cfg = await this.getPlatformConfig();

    // 1. 校验最低金额
    if (payload.amount < cfg.minAmount) {
      throw new BadRequestException(`最低提现金额为 ¥${cfg.minAmount}`);
    }

    // 2. 校验账户信息
    if (!payload.accountInfo.account || !payload.accountInfo.name) {
      throw new BadRequestException('请填写收款账号和姓名');
    }
    if (payload.method === 'BANK' && !payload.accountInfo.bankName) {
      throw new BadRequestException('银行卡提现需填写开户行');
    }

    // 3. 计算手续费和实际到账
    const fee = +(cfg.feeFixed + (payload.amount * cfg.feePercent) / 100).toFixed(2);
    const actual = +(payload.amount - fee).toFixed(2);
    if (actual <= 0) {
      throw new BadRequestException('提现金额不足以覆盖手续费');
    }

    // 4. 校验余额 + 事务扣款
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true, balance: true, freezeBalance: true, contactEmail: true, name: true },
      });
      if (!merchant) throw new NotFoundException('商户不存在');
      const available = Number(merchant.balance) - Number(merchant.freezeBalance);
      if (available < payload.amount) {
        throw new BadRequestException(
          `可提现余额不足：可用 ¥${available.toFixed(2)}，申请 ¥${payload.amount.toFixed(2)}`,
        );
      }

      // 立即扣减余额（避免重复提现），写入冻结（用于追踪"申请中"金额）
      await tx.merchant.update({
        where: { id: merchantId },
        data: {
          balance: { decrement: new Prisma.Decimal(payload.amount) },
          freezeBalance: { increment: new Prisma.Decimal(payload.amount) },
        },
      });

      // 写入提现记录
      return tx.withdrawal.create({
        data: {
          merchantId,
          amount: new Prisma.Decimal(payload.amount),
          fee: new Prisma.Decimal(fee),
          actual: new Prisma.Decimal(actual),
          method: payload.method,
          accountInfo: JSON.stringify(payload.accountInfo),
          status: 'PENDING',
        },
      });
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'withdrawal.apply',
      resourceType: 'withdrawal',
      resourceId: withdrawal.id,
      afterData: {
        amount: payload.amount,
        fee,
        actual,
        method: payload.method,
      },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`商户申请提现: merchant=${merchantId} amount=${payload.amount} fee=${fee}`);

    // 触发站内信：通知平台管理员审核
    void this.trigger.notifyWithdrawalPending(withdrawal.id);

    return {
      id: withdrawal.id,
      amount: Number(withdrawal.amount),
      fee: Number(withdrawal.fee),
      actual: Number(withdrawal.actual),
      method: withdrawal.method,
      status: withdrawal.status,
      requestedAt: withdrawal.requestedAt,
    };
  }

  /**
   * 平台审核通过（标记 APPROVING，提示管理员去打款）
   */
  async approve(adminCtx: { userId: string; username: string; ip: string; ua: string }, withdrawalId: string) {
    const w = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        merchant: { select: { id: true, name: true, contactEmail: true } },
      },
    });
    if (!w) throw new NotFoundException('提现记录不存在');
    if (w.status !== 'PENDING') {
      throw new BadRequestException(`当前状态 ${w.status}，无法审核通过`);
    }

    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVING',
        processedById: adminCtx.userId,
        processedAt: new Date(),
      },
    });

    // 通知商户
    await this.mail.send({
      to: w.merchant.contactEmail,
      subject: '【WM 卡密平台】提现申请已审核通过',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;background:#1a1d29;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#10b981;">✅ 提现申请已通过</h2>
          <p style="margin:0 0 12px;color:#a0aec0;">您的提现申请 <strong style="color:#fff;">¥${w.actual}</strong> 已通过审核，平台将尽快安排打款。</p>
          <p style="margin:24px 0 0;color:#718096;font-size:13px;">提现单号：${w.id}</p>
        </div>
      `,
      text: `您的提现申请 ¥${w.actual} 已通过审核。提现单号：${w.id}`,
    });

    await this.auditLog.record({
      actorId: adminCtx.userId,
      actorName: adminCtx.username,
      action: 'withdrawal.approve',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      beforeData: { status: 'PENDING' },
      afterData: { status: 'APPROVING' },
      ip: adminCtx.ip,
      userAgent: adminCtx.ua,
    });

    // 通知商户：提现已审核通过
    void this.trigger.notifyWithdrawalResult(withdrawalId, 'APPROVING');

    return { ok: true };
  }

  /**
   * 平台拒绝：解冻金额并退回 balance
   */
  async reject(
    adminCtx: { userId: string; username: string; ip: string; ua: string },
    withdrawalId: string,
    reason: string,
  ) {
    if (!reason || reason.length > 500) {
      throw new BadRequestException('请填写拒绝原因（1-500 字符）');
    }
    const w = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        merchant: { select: { id: true, name: true, contactEmail: true } },
      },
    });
    if (!w) throw new NotFoundException('提现记录不存在');
    if (w.status !== 'PENDING' && w.status !== 'APPROVING') {
      throw new BadRequestException(`当前状态 ${w.status}，无法拒绝`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          rejectReason: reason,
          processedById: adminCtx.userId,
          processedAt: new Date(),
        },
      });
      // 解冻并退回余额
      await tx.merchant.update({
        where: { id: w.merchantId },
        data: {
          balance: { increment: new Prisma.Decimal(w.amount) },
          freezeBalance: { decrement: new Prisma.Decimal(w.amount) },
        },
      });
    });

    await this.mail.send({
      to: w.merchant.contactEmail,
      subject: '【WM 卡密平台】提现申请已拒绝',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;background:#1a1d29;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#ef4444;">❌ 提现申请被拒绝</h2>
          <p style="margin:0 0 12px;color:#a0aec0;">提现单号：<code style="color:#fff;">${w.id}</code></p>
          <p style="margin:0 0 12px;color:#a0aec0;">原因：<strong style="color:#fff;">${reason}</strong></p>
          <p style="margin:24px 0 0;color:#718096;font-size:13px;">金额已退回可用余额，可重新申请。</p>
        </div>
      `,
      text: `您的提现申请已被拒绝。\n原因：${reason}\n金额已退回余额。`,
    });

    await this.auditLog.record({
      actorId: adminCtx.userId,
      actorName: adminCtx.username,
      action: 'withdrawal.reject',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      afterData: { reason },
      ip: adminCtx.ip,
      userAgent: adminCtx.ua,
    });

    // 通知商户：提现被拒绝
    void this.trigger.notifyWithdrawalResult(withdrawalId, 'REJECTED', reason);

    return { ok: true };
  }

  /**
   * 标记已打款（人工去打款后回来标记）
   * - transferRef 必填（打款流水号/交易号）
   * - 更新 status=PAID + 累计提现金额
   * - 减少冻结金额
   */
  async markPaid(
    adminCtx: { userId: string; username: string; ip: string; ua: string },
    withdrawalId: string,
    transferRef: string,
  ) {
    if (!transferRef || transferRef.length > 128) {
      throw new BadRequestException('请填写打款流水号/交易号（1-128 字符）');
    }
    const w = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!w) throw new NotFoundException('提现记录不存在');
    if (w.status !== 'APPROVING') {
      throw new BadRequestException(`当前状态 ${w.status}，需先审核通过`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'PAID',
          transferRef,
        },
      });
      // 累计提现金额增加 + 清除冻结
      await tx.merchant.update({
        where: { id: w.merchantId },
        data: {
          totalWithdrawn: { increment: new Prisma.Decimal(w.amount) },
          freezeBalance: { decrement: new Prisma.Decimal(w.amount) },
        },
      });
    });

    await this.auditLog.record({
      actorId: adminCtx.userId,
      actorName: adminCtx.username,
      action: 'withdrawal.paid',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      afterData: { transferRef },
      ip: adminCtx.ip,
      userAgent: adminCtx.ua,
    });

    this.logger.log(`提现已打款: id=${withdrawalId} transferRef=${transferRef} admin=${adminCtx.username}`);

    // 通知商户：提现已打款
    void this.trigger.notifyWithdrawalResult(withdrawalId, 'PAID');

    return { ok: true };
  }

  /** 商户查看自己的提现记录 */
  async listForMerchant(merchantId: string, query: { page: number; pageSize: number; status?: WithdrawalStatus }) {
    const where: Prisma.WithdrawalWhereInput = { merchantId };
    if (query.status) where.status = query.status;
    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return {
      items: items.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        fee: Number(w.fee),
        actual: Number(w.actual),
        method: w.method,
        status: w.status,
        rejectReason: w.rejectReason,
        transferRef: w.transferRef,
        requestedAt: w.requestedAt,
        processedAt: w.processedAt,
      })),
      total,
    };
  }

  /** 平台查看所有提现 */
  async listForAdmin(query: { page: number; pageSize: number; status?: WithdrawalStatus; keyword?: string }) {
    const where: Prisma.WithdrawalWhereInput = {};
    if (query.status) where.status = query.status;
    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          merchant: { select: { id: true, name: true, code: true, contactEmail: true } },
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return {
      items: items.map((w) => ({
        id: w.id,
        merchant: w.merchant,
        amount: Number(w.amount),
        fee: Number(w.fee),
        actual: Number(w.actual),
        method: w.method,
        status: w.status,
        rejectReason: w.rejectReason,
        transferRef: w.transferRef,
        requestedAt: w.requestedAt,
        processedAt: w.processedAt,
      })),
      total,
    };
  }

  /** 商户端：可提现余额信息 */
  async getBalance(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { balance: true, freezeBalance: true, totalWithdrawn: true },
    });
    if (!merchant) throw new NotFoundException('商户不存在');
    const cfg = await this.getPlatformConfig();
    return {
      balance: Number(merchant.balance),
      freezeBalance: Number(merchant.freezeBalance),
      available: Number(merchant.balance) - Number(merchant.freezeBalance),
      totalWithdrawn: Number(merchant.totalWithdrawn),
      minAmount: cfg.minAmount,
      feePercent: cfg.feePercent,
      feeFixed: cfg.feeFixed,
    };
  }

  /** 安全检查：清理 7 天前已打款/已拒绝的记录（保护数据库） */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldRecords(): Promise<void> {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 年前
    const result = await this.prisma.withdrawal.deleteMany({
      where: { status: { in: ['PAID', 'REJECTED'] }, createdAt: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(`清理 ${result.count} 条一年前已结算提现记录`);
    }
  }
}
