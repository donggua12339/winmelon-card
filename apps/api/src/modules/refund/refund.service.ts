import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SnowflakeService } from '../../infrastructure/id/snowflake.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PaymentService } from '../payment/payment.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { ORDER_REFUNDED_EVENT, type OrderRefundedPayload } from '../order/events/order-refunded.event';
import { Prisma } from '@prisma/client';

/** 商户负余额硬上限（-¥1000），超过需 SUPER_ADMIN 强制覆盖 */
const MERCHANT_BALANCE_FLOOR = -1000;

/** 退款原因最大长度 */
const REFUND_REASON_MAX_LENGTH = 500;

/** 退款审核超时时间（7 天），超时自动拒绝（Q17 决策 b） */
const REFUND_APPROVAL_TIMEOUT_DAYS = 7;

/** T3 阶段 2 实际退钱：自动重试退避（毫秒） */
const REFUND_RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000] as const; // 1m, 5m, 30m
const REFUND_MAX_RETRY_COUNT = 3;

/** 严重告警去重间隔（同一 refund 1 小时内只发一次告警） */
const REFUND_ALERT_DEDUP_MS = 60 * 60 * 1000;

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snowflake: SnowflakeService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly paymentService: PaymentService,
    private readonly mail: MailService,
  ) {}

  /**
   * 创建退款申请（PENDING）
   * - 校验订单状态（PAID/DELIVERED）
   * - viewed_at 有值时拒绝（Q13 决策 a：需 SUPER_ADMIN 人工处理）
   * - 幂等：同一订单只有一个 PENDING/APPROVED 退款
   */
  async create(
    orderId: string,
    params: { reason: string; initiator: 'BUYER' | 'PLATFORM'; amount?: number },
    ctx?: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; refundNo: string; status: string }> {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new BadRequestException('退款原因不能为空');
    }
    if (params.reason.length > REFUND_REASON_MAX_LENGTH) {
      throw new BadRequestException(`退款原因不能超过 ${REFUND_REASON_MAX_LENGTH} 字`);
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        status: true,
        viewedAt: true,
        merchantId: true,
        shop: { select: { merchantId: true } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');

    if (!['PAID', 'DELIVERED'].includes(order.status)) {
      throw new BadRequestException(`订单状态 ${order.status} 不支持退款（仅 PAID/DELIVERED 可退款）`);
    }

    // Q13: viewed_at 有值 = 卡密已被查看，拒绝自动退款
    if (order.viewedAt) {
      throw new ForbiddenException('买家已查看卡密，需 SUPER_ADMIN 人工处理退款');
    }

    // 幂等：同一订单已有 PENDING/APPROVED 退款
    const existing = await this.prisma.refund.findFirst({
      where: { orderId, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true, refundNo: true, status: true },
    });
    if (existing) {
      throw new BadRequestException(`订单已存在退款申请 ${existing.refundNo}（状态 ${existing.status}）`);
    }

    const refundAmount = params.amount ?? Number(order.totalAmount);
    if (refundAmount <= 0 || refundAmount > Number(order.totalAmount)) {
      throw new BadRequestException('退款金额必须大于 0 且不超过订单总额');
    }

    const merchantId = order.merchantId ?? order.shop.merchantId;
    const refundNo = this.snowflake.next();

    const refund = await this.prisma.refund.create({
      data: {
        id: crypto.randomUUID(),
        refundNo,
        orderId: order.id,
        merchantId,
        amount: new Prisma.Decimal(refundAmount),
        reason: params.reason.trim(),
        status: 'PENDING',
        initiator: params.initiator,
      },
    });

    if (ctx) {
      await this.auditLog.record({
        actorId: ctx.userId,
        action: 'refund.create',
        resourceType: 'refund',
        resourceId: refund.id,
        afterData: {
          refundNo,
          orderId: order.id,
          orderNo: order.orderNo,
          amount: refundAmount,
          initiator: params.initiator,
        },
        ip: ctx.ip,
        userAgent: ctx.ua,
      });
    }

    this.logger.log(`退款申请创建: refundNo=${refundNo} orderNo=${order.orderNo} amount=¥${refundAmount}`);
    return { id: refund.id, refundNo: refund.refundNo, status: refund.status };
  }

  /**
   * 创建并直接打款（跳过审核）
   * 用于工单超时自动退款等无需人工审核的场景
   * 仍保留 viewed_at 检查（Q13 约束）+ 余额上限检查（Q11 约束）
   */
  async createAndPayDirect(
    orderId: string,
    params: {
      reason: string;
      initiator: 'BUYER' | 'PLATFORM';
      amount?: number;
      manualPayout?: boolean;
      tradeNo?: string;
    },
    ctx?: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; refundNo: string; status: string }> {
    // 复用 create 的校验逻辑
    const created = await this.create(orderId, params, ctx);
    // 直接 markPaid（跳过 approve）
    return this.markPaid(
      created.id,
      { manualPayout: params.manualPayout, tradeNo: params.tradeNo },
      ctx ?? { userId: '', ip: '', ua: '' },
    );
  }

  /**
   * 审核通过（PENDING -> APPROVED）
   * 仅 SUPER_ADMIN 可调用（controller 层 RolesGuard 保证）
   */
  async approve(
    refundId: string,
    ctx: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; status: string }> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('退款记录不存在');
    if (refund.status !== 'PENDING') {
      throw new BadRequestException(`退款状态 ${refund.status} 不能审核`);
    }

    await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'APPROVED',
        processedById: ctx.userId,
        processedAt: new Date(),
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'refund.approve',
      resourceType: 'refund',
      resourceId: refundId,
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`退款审核通过: refundNo=${refund.refundNo}`);
    return { id: refundId, status: 'APPROVED' };
  }

  /**
   * 拒绝退款（PENDING -> REJECTED）
   */
  async reject(
    refundId: string,
    rejectReason: string,
    ctx: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; status: string }> {
    if (!rejectReason.trim()) throw new BadRequestException('拒绝原因不能为空');

    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('退款记录不存在');
    if (refund.status !== 'PENDING') {
      throw new BadRequestException(`退款状态 ${refund.status} 不能拒绝`);
    }

    await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        rejectReason: rejectReason.trim(),
        rejectedAt: new Date(),
        processedById: ctx.userId,
        processedAt: new Date(),
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'refund.reject',
      resourceType: 'refund',
      resourceId: refundId,
      afterData: { rejectReason },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`退款已拒绝: refundNo=${refund.refundNo} reason=${rejectReason}`);
    return { id: refundId, status: 'REJECTED' };
  }

  /**
   * T3 阶段 2：重试通道退款（APPROVED/FAILED -> PAID/FAILED）
   * - 自动重试入口：Cron 每分钟扫描 FAILED + nextRetryAt <= now
   * - 手动重试入口：admin 按钮触发
   * - 指数退避：1m / 5m / 30m（已重试 0/1/2 次）
   * - 3 次耗尽后发严重告警（站内信 + 邮件）
   */
  async retryRefund(refundId: string): Promise<{ id: string; status: string; retryCount: number }> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('退款记录不存在');
    if (refund.manualPayout) {
      throw new BadRequestException('manualPayout=true 的退款不走通道重试');
    }
    if (!['APPROVED', 'FAILED'].includes(refund.status)) {
      throw new BadRequestException(`退款状态 ${refund.status} 不能重试（需 APPROVED/FAILED）`);
    }
    if (refund.retryCount >= REFUND_MAX_RETRY_COUNT) {
      throw new BadRequestException(`已达最大重试次数 ${REFUND_MAX_RETRY_COUNT}，请 SUPER_ADMIN 手动介入`);
    }

    try {
      const channelResult = await this.paymentService.refundChannel({
        orderId: refund.orderId,
        refundNo: refund.refundNo,
        amount: refund.amount.toString(),
        reason: '买家退款（重试）',
      });

      // 成功：直接走 markPaid 流程（不重置 retryCount，保留作为审计）
      await this.markPaid(
        refundId,
        { manualPayout: false, tradeNo: channelResult.tradeNo },
        { userId: 'system:retry', ip: '', ua: 'system/cron' },
      );
      this.logger.log(`退款重试成功: refundNo=${refund.refundNo} retryCount=${refund.retryCount + 1}`);
      return { id: refundId, status: 'PAID', retryCount: refund.retryCount + 1 };
    } catch (err) {
      const error = (err as Error).message;
      const newRetryCount = refund.retryCount + 1;
      const nextBackoff = REFUND_RETRY_BACKOFF_MS[Math.min(newRetryCount, REFUND_RETRY_BACKOFF_MS.length - 1)];
      const nextRetryAt = new Date(Date.now() + (nextBackoff ?? 30 * 60_000));

      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'FAILED',
          retryCount: newRetryCount,
          lastError: error.slice(0, 2000),
          lastErrorAt: new Date(),
          nextRetryAt: newRetryCount >= REFUND_MAX_RETRY_COUNT ? null : nextRetryAt,
        },
      });

      this.logger.warn(
        `退款重试失败: refundNo=${refund.refundNo} retryCount=${newRetryCount} nextRetryAt=${nextRetryAt.toISOString()}`,
      );

      // 3 次耗尽：发严重告警
      if (newRetryCount >= REFUND_MAX_RETRY_COUNT) {
        await this.sendSevereAlert(refund.id);
      }

      return { id: refundId, status: 'FAILED', retryCount: newRetryCount };
    }
  }

  /**
   * 严重告警：站内信 + 邮件给所有 SUPER_ADMIN
   * - 1 小时内同一 refund 不重复发（alertSentAt 去重）
   */
  private async sendSevereAlert(refundId: string): Promise<void> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      select: {
        refundNo: true,
        retryCount: true,
        lastError: true,
        amount: true,
        alertSentAt: true,
        order: { select: { orderNo: true, totalAmount: true, buyerEmail: true } },
      },
    });
    if (!refund) return;

    // 去重：1 小时内已发过则跳过
    if (refund.alertSentAt && Date.now() - refund.alertSentAt.getTime() < REFUND_ALERT_DEDUP_MS) {
      return;
    }

    // 找所有 SUPER_ADMIN
    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null },
      select: { id: true, email: true },
    });

    const title = `🚨 退款重试耗尽: ${refund.refundNo}`;
    const content =
      `订单 ${refund.order.orderNo} 退款 ¥${refund.amount} 通道重试 ${refund.retryCount} 次均失败。\n` +
      `买家：${refund.order.buyerEmail}\n` +
      `最后错误：${refund.lastError ?? '未知'}\n\n` +
      `请前往 /admin/refunds 手动处理（标记 manualPayout=true 走线下打款，或排查通道问题）。`;

    // 站内信
    for (const admin of admins) {
      await this.prisma.notification
        .create({
          data: {
            recipientUserId: admin.id,
            type: 'SYSTEM',
            title: title.slice(0, 255),
            content: content.slice(0, 65535),
            link: '/admin/refunds',
          },
        })
        .catch((err) => this.logger.error(`发送告警站内信失败: ${(err as Error).message}`));

      // 同步发邮件
      if (admin.email) {
        await this.mail
          .send({
            to: admin.email,
            subject: title,
            html: `<pre style="font-family:sans-serif">${content.replace(/\n/g, '<br>')}</pre>`,
            text: content,
          })
          .catch((err) => this.logger.error(`发送告警邮件失败: ${(err as Error).message}`));
      }
    }

    // 更新 alertSentAt（去重锚点）
    await this.prisma.refund.update({
      where: { id: refundId },
      data: { alertSentAt: new Date() },
    });

    this.logger.error(`退款严重告警已发送: refundNo=${refund.refundNo} admins=${admins.length}`);
  }

  /**
   * T3 每分钟扫描：FAILED + nextRetryAt <= now + retryCount < 3 的退款自动重试
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedRefunds(): Promise<void> {
    const due = await this.prisma.refund.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: REFUND_MAX_RETRY_COUNT },
        nextRetryAt: { lte: new Date() },
        manualPayout: false,
      },
      select: { id: true, refundNo: true, retryCount: true, nextRetryAt: true },
      take: 20,
    });

    if (due.length === 0) return;
    this.logger.log(`扫描到 ${due.length} 个到时待重试退款`);

    for (const r of due) {
      try {
        await this.retryRefund(r.id);
      } catch (err) {
        this.logger.error(`退款自动重试异常: refundNo=${r.refundNo} ${(err as Error).message}`);
      }
    }
  }

  /**
   * 标记已打款（APPROVED -> PAID）
   * 阶段 1：商户余额扣减 + 卡密重置 + 触发 ORDER_REFUNDED_EVENT（返佣冲正）
   * 阶段 2：调支付通道原路退款后调用此方法
   *
   * @param manualPayout true=线下手动打款（USDT 等），false=通道原路退款
   * @param tradeNo 通道退款流水号（manualPayout=false 时必填）
   */
  async markPaid(
    refundId: string,
    params: {
      manualPayout?: boolean;
      tradeNo?: string;
      forceOverride?: boolean;
      usdt?: { txHash: string; senderWallet: string; receiverWallet: string };
    },
    ctx: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; refundNo: string; status: string }> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('退款记录不存在');
    if (refund.status !== 'APPROVED') {
      throw new BadRequestException(`退款状态 ${refund.status} 不能标记打款（需 APPROVED）`);
    }

    const manualPayout = params.manualPayout ?? false;

    // 阶段 2 实际退钱：非 manualPayout 时调通道 API 拿 tradeNo
    // 通道退款失败 → 抛错，状态保持 APPROVED，admin 可重试或改 manualPayout
    let channelTradeNo: string | null = null;
    if (!manualPayout) {
      if (params.tradeNo) {
        // admin 手动提供 tradeNo（已通过其他渠道退款）
        channelTradeNo = params.tradeNo;
      } else {
        // 调通道原路退款
        try {
          const channelResult = await this.paymentService.refundChannel({
            orderId: refund.orderId,
            refundNo: refund.refundNo,
            amount: refund.amount.toString(),
            reason: '买家退款',
          });
          channelTradeNo = channelResult.tradeNo;
        } catch (err) {
          this.logger.error(`通道退款失败: refundNo=${refund.refundNo} error=${(err as Error).message}`);
          // 抛 BadRequest 让 controller 返回 400，admin 可改 manualPayout 重试
          throw new BadRequestException(`通道退款失败：${(err as Error).message}`);
        }
      }
    }

    // 事务：Refund -> PAID + 订单 -> REFUNDED + 商户余额扣减 + 卡密重置
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: refund.orderId },
        select: {
          id: true,
          orderNo: true,
          status: true,
          viewedAt: true,
          merchantId: true,
          shop: { select: { merchantId: true } },
        },
      });
      if (!order) throw new NotFoundException('订单不存在');

      // 1. Refund -> PAID
      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          tradeNo: channelTradeNo,
          manualPayout,
          // USDT 链上信息（manualPayout + usdt 三件套均需提供）
          ...(params.usdt && {
            usdtTxHash: params.usdt.txHash,
            usdtSenderWallet: params.usdt.senderWallet,
            usdtReceiverWallet: params.usdt.receiverWallet,
          }),
          // 成功后清空 nextRetryAt
          nextRetryAt: null,
        },
      });

      // 2. 订单 -> REFUNDED（仅 PAID/DELIVERED 可转）
      if (['PAID', 'DELIVERED'].includes(order.status)) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' },
        });
      }

      // 3. 商户余额扣减（允许负数，但检查 -¥1000 硬上限）
      const merchantId = order.merchantId ?? order.shop.merchantId;
      if (merchantId) {
        const merchant = await tx.merchant.findUnique({
          where: { id: merchantId },
          select: { balance: true, name: true },
        });
        if (merchant) {
          const newBalance = Number(merchant.balance) - Number(refund.amount);
          if (newBalance < MERCHANT_BALANCE_FLOOR && !params.forceOverride) {
            throw new BadRequestException(
              `商户 ${merchant.name} 余额将降至 ¥${newBalance.toFixed(2)}，低于下限 ¥${MERCHANT_BALANCE_FLOOR}，需 SUPER_ADMIN 强制覆盖`,
            );
          }
          await tx.merchant.update({
            where: { id: merchantId },
            data: { balance: { decrement: new Prisma.Decimal(Number(refund.amount)) } },
          });
          if (newBalance < MERCHANT_BALANCE_FLOOR && params.forceOverride) {
            this.logger.warn(
              `管理员 ${ctx.userId} 强制覆盖 -¥1000 下限：商户 ${merchant.name} 余额 ¥${newBalance.toFixed(2)}`,
            );
          }
        }
      }

      // 4. 卡密重置：viewed_at 无值的 SOLD 卡密 -> AVAILABLE，清空 orderId
      // Q13 约束：viewed_at 有值的订单退款在 create 阶段已拒绝，此处 viewedAt 必为 null
      const cards = await tx.stockCard.findMany({
        where: { orderId: order.id, status: 'SOLD' },
        select: { id: true },
      });
      if (cards.length > 0) {
        await tx.stockCard.updateMany({
          where: { id: { in: cards.map((c) => c.id) } },
          data: { status: 'AVAILABLE', orderId: null, soldAt: null },
        });
      }

      return { refund: updated, orderNo: order.orderNo, merchantId: merchantId ?? '' };
    });

    // 事务外发事件（P1-8 修复模式：避免事务回滚但事件已发）
    const payload: OrderRefundedPayload = {
      refundId: refund.id,
      refundNo: refund.refundNo,
      orderId: refund.orderId,
      orderNo: result.orderNo,
      merchantId: result.merchantId,
      amount: refund.amount.toString(),
      paidAt: new Date(),
    };
    this.eventEmitter.emit(ORDER_REFUNDED_EVENT, payload);

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'refund.markPaid',
      resourceType: 'refund',
      resourceId: refundId,
      afterData: { status: 'PAID', manualPayout, tradeNo: params.tradeNo ?? null, amount: refund.amount.toString() },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`退款已打款: refundNo=${refund.refundNo} amount=¥${refund.amount} manualPayout=${manualPayout}`);
    return { id: refundId, refundNo: refund.refundNo, status: 'PAID' };
  }

  /**
   * 列出退款（平台后台）
   */
  async listForAdmin(params: { page?: number; pageSize?: number; status?: string; merchantId?: string }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(params.pageSize ?? 20, 100);
    const where: Prisma.RefundWhereInput = {};
    if (params.status) where.status = params.status as Prisma.RefundWhereInput['status'];
    if (params.merchantId) where.merchantId = params.merchantId;

    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          order: { select: { orderNo: true, totalAmount: true, buyerEmail: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * 通道退款失败（APPROVED -> FAILED）
   * 3 次失败后转人工（status 保持 FAILED，需 SUPER_ADMIN 介入）
   */
  async markFailed(
    refundId: string,
    error: string,
    ctx: { userId: string; ip: string; ua: string },
  ): Promise<{ id: string; status: string; retryCount: number }> {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException('退款记录不存在');
    if (!['APPROVED', 'FAILED'].includes(refund.status)) {
      throw new BadRequestException(`退款状态 ${refund.status} 不能标记失败`);
    }

    const retryCount = refund.retryCount + 1;
    const nextBackoff = REFUND_RETRY_BACKOFF_MS[Math.min(retryCount, REFUND_RETRY_BACKOFF_MS.length - 1)];
    const nextRetryAt =
      retryCount >= REFUND_MAX_RETRY_COUNT ? null : new Date(Date.now() + (nextBackoff ?? 30 * 60_000));

    await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'FAILED',
        retryCount,
        lastError: error.slice(0, 2000),
        lastErrorAt: new Date(),
        nextRetryAt,
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'refund.markFailed',
      resourceType: 'refund',
      resourceId: refundId,
      afterData: { retryCount, error: error.slice(0, 500) },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.warn(
      `退款通道失败: refundNo=${refund.refundNo} retryCount=${retryCount} nextRetryAt=${nextRetryAt?.toISOString() ?? 'null'}`,
    );

    // 3 次耗尽：发严重告警
    if (retryCount >= REFUND_MAX_RETRY_COUNT) {
      await this.sendSevereAlert(refundId);
    }

    return { id: refundId, status: 'FAILED', retryCount };
  }

  /**
   * 财务对账：日维度聚合
   * @param days 查询最近 N 天（默认 7）
   */
  async getFinanceDailyReport(days = 7): Promise<{
    days: Array<{
      date: string;
      revenue: string;
      refundAmount: string;
      netRevenue: string;
      orderCount: number;
      refundCount: number;
      refundRate: string;
    }>;
    totals: {
      revenue: string;
      refundAmount: string;
      netRevenue: string;
      orderCount: number;
      refundCount: number;
    };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    // 用 SQL 聚合（Prisma groupBy 不支持日期截断，用 raw query）
    const orderGroups = await this.prisma.$queryRaw<Array<{ date: string; revenue: number; count: number }>>(Prisma.sql`
      SELECT DATE(paidAt) AS date, SUM(totalAmount) AS revenue, COUNT(*) AS count
      FROM orders
      WHERE status IN ('PAID', 'DELIVERED', 'REFUNDED')
        AND paidAt >= ${start}
      GROUP BY DATE(paidAt)
      ORDER BY date ASC
    `);

    const refundGroups = await this.prisma.$queryRaw<Array<{ date: string; amount: number; count: number }>>(Prisma.sql`
      SELECT DATE(paidAt) AS date, SUM(amount) AS amount, COUNT(*) AS count
      FROM refunds
      WHERE status = 'PAID'
        AND paidAt >= ${start}
      GROUP BY DATE(paidAt)
      ORDER BY date ASC
    `);

    const byDate = new Map<string, { revenue: number; refund: number; orderCount: number; refundCount: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, { revenue: 0, refund: 0, orderCount: 0, refundCount: 0 });
    }
    for (const g of orderGroups) {
      const key = new Date(g.date as unknown as string).toISOString().slice(0, 10);
      const entry = byDate.get(key);
      if (entry) {
        entry.revenue = Number(g.revenue);
        entry.orderCount = Number(g.count);
      }
    }
    for (const g of refundGroups) {
      const key = new Date(g.date as unknown as string).toISOString().slice(0, 10);
      const entry = byDate.get(key);
      if (entry) {
        entry.refund = Number(g.amount);
        entry.refundCount = Number(g.count);
      }
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    let totalRevenue = 0;
    let totalRefund = 0;
    let totalOrderCount = 0;
    let totalRefundCount = 0;
    const daysArr = sortedDates.map((date) => {
      const d = byDate.get(date)!;
      totalRevenue += d.revenue;
      totalRefund += d.refund;
      totalOrderCount += d.orderCount;
      totalRefundCount += d.refundCount;
      const net = d.revenue - d.refund;
      const rate = d.orderCount > 0 ? (d.refundCount / d.orderCount) * 100 : 0;
      return {
        date,
        revenue: d.revenue.toFixed(2),
        refundAmount: d.refund.toFixed(2),
        netRevenue: net.toFixed(2),
        orderCount: d.orderCount,
        refundCount: d.refundCount,
        refundRate: rate.toFixed(2),
      };
    });

    return {
      days: daysArr,
      totals: {
        revenue: totalRevenue.toFixed(2),
        refundAmount: totalRefund.toFixed(2),
        netRevenue: (totalRevenue - totalRefund).toFixed(2),
        orderCount: totalOrderCount,
        refundCount: totalRefundCount,
      },
    };
  }

  /**
   * 每 10 分钟扫描：PENDING 超 7 天的退款自动拒绝（Q17 决策 b）
   * - 防止退款申请无限期挂起
   * - 自动拒绝记 rejectReason + audit log
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoRejectExpired(): Promise<void> {
    const cutoff = new Date(Date.now() - REFUND_APPROVAL_TIMEOUT_DAYS * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.refund.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      select: { id: true, refundNo: true, orderId: true },
      take: 50,
    });

    if (expired.length === 0) return;
    this.logger.log(`扫描到 ${expired.length} 个超时未审核退款，开始自动拒绝`);

    for (const refund of expired) {
      try {
        await this.prisma.refund.update({
          where: { id: refund.id },
          data: {
            status: 'REJECTED',
            rejectReason: `超 ${REFUND_APPROVAL_TIMEOUT_DAYS} 天未审核，系统自动拒绝`,
            rejectedAt: new Date(),
          },
        });

        await this.auditLog.record({
          actorId: 'system',
          action: 'refund.autoReject',
          resourceType: 'refund',
          resourceId: refund.id,
          afterData: { refundNo: refund.refundNo, reason: 'timeout' },
          ip: '',
          userAgent: 'system/cron',
        });

        this.logger.log(`退款超时自动拒绝: refundNo=${refund.refundNo}`);
      } catch (err) {
        this.logger.error(`退款 ${refund.refundNo} 自动拒绝失败: ${(err as Error).message}`);
      }
    }
  }
}
