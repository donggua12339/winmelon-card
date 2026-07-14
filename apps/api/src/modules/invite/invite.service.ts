import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';
import { randomBytes } from 'crypto';

const DEFAULT_COMMISSION_RATE = 0.05; // 默认 5% 返佣
const SYSTEM_CONFIG_KEY = 'commission_rate';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ============== 邀请码管理 ==============

  /** 生成 8 字符邀请码（base36，去歧义字符） */
  private generateCode(): string {
    const alphabet = '23456789abcdefghjkmnpqrstuvwxyz'; // 去 0/O/1/I/l
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += alphabet[bytes[i]! % alphabet.length];
    }
    return code;
  }

  /** 商户生成邀请码 */
  async createCode(merchantId: string, note?: string, ctx?: { userId: string; ip?: string; ua?: string }) {
    // 最多重试 5 次防碰撞
    let code = '';
    for (let i = 0; i < 5; i++) {
      const candidate = this.generateCode();
      const exists = await this.prisma.inviteCode.findUnique({ where: { code: candidate } });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new BadRequestException('邀请码生成失败，请重试');

    const invite = await this.prisma.inviteCode.create({
      data: { code, inviterMerchantId: merchantId, note: note?.slice(0, 255) },
    });

    if (ctx) {
      await this.auditLog.record({
        actorId: ctx.userId,
        action: 'invite_code.create',
        resourceType: 'invite_code',
        resourceId: invite.id,
        afterData: { code, note },
        ip: ctx.ip,
        userAgent: ctx.ua,
      });
    }

    return invite;
  }

  /** 商户查看自己的邀请码 */
  async listCodesForMerchant(merchantId: string) {
    return this.prisma.inviteCode.findMany({
      where: { inviterMerchantId: merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 商户删除邀请码（软删：直接物理删，因为没绑定订单的码可重用） */
  async deleteCode(merchantId: string, codeId: string) {
    const code = await this.prisma.inviteCode.findFirst({
      where: { id: codeId, inviterMerchantId: merchantId },
    });
    if (!code) throw new NotFoundException('邀请码不存在');
    // 已被使用的码不能删
    if (code.usedCount > 0) {
      throw new BadRequestException('邀请码已被使用，不能删除');
    }
    await this.prisma.inviteCode.delete({ where: { id: codeId } });
    return { ok: true };
  }

  /** 验证邀请码（买家下单时调用） */
  async validateCode(code: string): Promise<{ valid: boolean; inviterMerchantId?: string }> {
    if (!code) return { valid: false };
    const invite = await this.prisma.inviteCode.findUnique({ where: { code } });
    if (!invite) return { valid: false };
    return { valid: true, inviterMerchantId: invite.inviterMerchantId };
  }

  // ============== 返佣统计 ==============

  /** 商户查看自己作为邀请人的返佣记录 */
  async listCommissionsForInviter(merchantId: string, query: { page: number; pageSize: number }) {
    const where: Prisma.CommissionRecordWhereInput = { inviterMerchantId: merchantId };
    const [items, total] = await Promise.all([
      this.prisma.commissionRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          source: { select: { name: true, code: true } },
        },
      }),
      this.prisma.commissionRecord.count({ where }),
    ]);
    return {
      items: items.map((r) => ({
        id: r.id,
        orderNo: r.orderNo,
        sourceMerchantName: r.source.name,
        baseAmount: Number(r.baseAmount),
        rate: Number(r.rate),
        amount: Number(r.amount),
        status: r.status,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  /** 商户邀请统计：总返佣、本月返佣、邀请码数量、被邀请商户数 */
  async getInviteStats(merchantId: string) {
    const [totalCommission, monthCommission, codeCount, usedCodeCount, uniqueSources] = await Promise.all([
      this.prisma.commissionRecord.aggregate({
        _sum: { amount: true },
        where: { inviterMerchantId: merchantId, status: 'SETTLED' },
      }),
      this.prisma.commissionRecord.aggregate({
        _sum: { amount: true },
        where: {
          inviterMerchantId: merchantId,
          status: 'SETTLED',
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      this.prisma.inviteCode.count({ where: { inviterMerchantId: merchantId } }),
      this.prisma.inviteCode.count({
        where: { inviterMerchantId: merchantId, usedCount: { gt: 0 } },
      }),
      this.prisma.commissionRecord.findMany({
        where: { inviterMerchantId: merchantId },
        select: { sourceMerchantId: true },
        distinct: ['sourceMerchantId'],
      }),
    ]);

    return {
      totalCommission: Number(totalCommission._sum.amount ?? 0),
      monthCommission: Number(monthCommission._sum.amount ?? 0),
      codeCount,
      usedCodeCount,
      invitedMerchantCount: uniqueSources.length,
    };
  }

  // ============== 返佣计算（监听 OrderPaidEvent）==============

  /**
   * 订单支付成功后触发返佣
   * - 检查订单的 usedInviteCode
   * - 查邀请码归属（inviterMerchantId）
   * - 被邀请商户不能是邀请人自己（防自邀）
   * - 计算 baseAmount * rate = 返佣金额
   * - 事务：写 CommissionRecord + source balance 扣减 + inviter balance 增加
   */
  @OnEvent(ORDER_PAID_EVENT)
  async handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
    try {
      await this.settleCommission(payload);
    } catch (err) {
      this.logger.error(`返佣结算失败 orderNo=${payload.orderNo}: ${(err as Error).message}`);
    }
  }

  private async settleCommission(payload: OrderPaidPayload): Promise<void> {
    // 查订单 + 邀请码 + 店铺
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        usedInviteCode: true,
        shop: { select: { merchantId: true } },
      },
    });
    if (!order || !order.usedInviteCode) return;

    const invite = await this.prisma.inviteCode.findUnique({
      where: { code: order.usedInviteCode },
    });
    if (!invite) return;

    const sourceMerchantId = order.shop.merchantId;
    const inviterMerchantId = invite.inviterMerchantId;

    // 防自邀
    if (sourceMerchantId === inviterMerchantId) {
      this.logger.warn(`自邀拦截: orderNo=${order.orderNo} merchantId=${sourceMerchantId}`);
      return;
    }

    // 查平台返佣比例（system_configs）
    const rateConfig = await this.prisma.systemConfig.findUnique({
      where: { key: SYSTEM_CONFIG_KEY },
    });
    const rate = rateConfig ? Number(rateConfig.value) : DEFAULT_COMMISSION_RATE;
    if (rate <= 0 || rate > 1) {
      this.logger.warn(`返佣比例异常: ${rate}，跳过`);
      return;
    }

    // MVP 简化：baseAmount = 订单金额（未来改为商户利润 = 订单金额 - 成本 - 平台抽成）
    const baseAmount = Number(order.totalAmount);
    const amount = +(baseAmount * rate).toFixed(2);
    if (amount <= 0) return;

    // 事务：写返佣记录 + 扣 source balance + 加 inviter balance + 邀请码 usedCount++
    await this.prisma.$transaction(async (tx) => {
      // 幂等：检查是否已结算
      const existing = await tx.commissionRecord.findFirst({
        where: { orderId: order.id, status: 'SETTLED' },
        select: { id: true },
      });
      if (existing) return;

      await tx.commissionRecord.create({
        data: {
          inviterMerchantId,
          sourceMerchantId,
          orderId: order.id,
          orderNo: order.orderNo,
          baseAmount: new Prisma.Decimal(baseAmount),
          rate: new Prisma.Decimal(rate),
          amount: new Prisma.Decimal(amount),
          status: 'SETTLED',
        },
      });

      // source 商户扣减（允许负数，MVP 阶段商户利润 = 订单金额，返佣从利润出）
      await tx.merchant.update({
        where: { id: sourceMerchantId },
        data: { balance: { decrement: new Prisma.Decimal(amount) } },
      });

      // inviter 商户增加
      await tx.merchant.update({
        where: { id: inviterMerchantId },
        data: { balance: { increment: new Prisma.Decimal(amount) } },
      });

      // 邀请码 usedCount++
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });
    });

    this.logger.log(`返佣结算成功: orderNo=${order.orderNo} inviter=${inviterMerchantId} amount=${amount}`);
  }

  // ============== 定时任务：订单退款时冲正返佣 ==============

  /**
   * 每 5 分钟扫描：已 REFUNDED 订单的返佣记录冲正
   * MVP 简化：暂不实现退款冲正（退款流程未完善）
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async reverseRefundedCommissions(): Promise<void> {
    // TODO: 退款流程完善后实现
  }
}
