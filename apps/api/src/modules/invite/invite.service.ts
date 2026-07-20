import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';
import { ORDER_REFUNDED_EVENT, type OrderRefundedPayload } from '../order/events/order-refunded.event';
import { COMMISSION_EARNED_EVENT, type CommissionEarnedPayload } from './events/invite.events';
import { randomBytes } from 'crypto';

const DEFAULT_COMMISSION_RATE = 0.05; // 默认 5% 返佣
const SYSTEM_CONFIG_KEY = 'commission_rate';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: RedisService,
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
        shop: {
          select: {
            merchantId: true,
            merchant: {
              select: {
                name: true,
                inviterMerchantId: true,
                allowBuyerInviteCode: true,
              },
            },
          },
        },
      },
    });
    if (!order) return;

    const sourceMerchantId = order.shop.merchantId;
    const merchantInviterId = order.shop.merchant.inviterMerchantId;

    // F3: 查平台各层级返佣比例（system_configs：commission_level_1/2/3_rate）
    const rates: number[] = [];
    for (let level = 1; level <= 3; level++) {
      const config = await this.prisma.systemConfig.findUnique({
        where: { key: `commission_level_${level}_rate` },
      });
      rates.push(config ? Number(config.value) : 0);
    }
    // 兼容旧配置：单层 commission_rate 用作 1级
    if (rates[0] === 0) {
      const legacy = await this.prisma.systemConfig.findUnique({
        where: { key: SYSTEM_CONFIG_KEY },
      });
      rates[0] = legacy ? Number(legacy.value) : DEFAULT_COMMISSION_RATE;
    }

    // MVP 简化：baseAmount = 订单金额（未来改为商户利润 = 订单金额 - 成本 - 平台抽成）
    const baseAmount = Number(order.totalAmount);
    if (baseAmount <= 0) return;

    // 构建返佣链：优先入驻关系（多级），无入驻关系才走下单码（单级）
    const levels: Array<{ level: number; inviterId: string; rate: number }> = [];

    if (merchantInviterId) {
      // 路径 A：入驻关系多级链
      let currentInviterId: string | null = merchantInviterId;
      for (let level = 1; level <= 3; level++) {
        const rate = rates[level - 1] ?? 0;
        if (!currentInviterId || rate <= 0) break;
        if (currentInviterId === sourceMerchantId) break; // 防自邀
        levels.push({ level, inviterId: currentInviterId, rate });
        const upper: { inviterMerchantId: string | null } | null = await this.prisma.merchant.findUnique({
          where: { id: currentInviterId },
          select: { inviterMerchantId: true },
        });
        currentInviterId = upper?.inviterMerchantId ?? null;
      }
    } else if (order.usedInviteCode) {
      // 路径 B：下单码单级返佣（无入驻关系时）
      // 双开关检查：全局 + 商户级
      const globalEnabled = await this.prisma.systemConfig.findUnique({
        where: { key: 'buyer_invite_code_global_enabled' },
      });
      const globalOn = globalEnabled ? globalEnabled.value === 'true' : false;
      if (!globalOn || !order.shop.merchant.allowBuyerInviteCode) {
        // 开关关，下单码不返佣
        this.logger.debug(
          `下单码返佣开关关: orderNo=${order.orderNo} global=${globalOn} merchant=${order.shop.merchant.allowBuyerInviteCode}`,
        );
        return;
      }

      const invite = await this.prisma.inviteCode.findUnique({
        where: { code: order.usedInviteCode },
        select: { id: true, inviterMerchantId: true },
      });
      if (!invite) return;

      // 仅限本店铺：inviteCode.inviterMerchantId 必须是 sourceMerchantId
      if (invite.inviterMerchantId !== sourceMerchantId) {
        this.logger.debug(
          `下单码非本店铺: orderNo=${order.orderNo} codeOwner=${invite.inviterMerchantId} shopMerchant=${sourceMerchantId}`,
        );
        return;
      }

      // 防自邀（理论上不会触发，因为仅限本店铺且 source=codeOwner）
      if (sourceMerchantId === invite.inviterMerchantId) {
        // 自邀：店铺商户用了自己的邀请码 -> 实际就是单级返佣给自己，不允许
        this.logger.warn(`自邀拦截: orderNo=${order.orderNo} merchantId=${sourceMerchantId}`);
        return;
      }

      // 单级返佣
      const rate = rates[0] ?? 0;
      if (rate > 0) {
        levels.push({ level: 1, inviterId: invite.inviterMerchantId, rate });
      }
    }

    if (levels.length === 0) return;

    // 事务：每级创建 CommissionRecord + balance 更新
    await this.prisma.$transaction(async (tx) => {
      // 幂等：检查是否已结算
      const existing = await tx.commissionRecord.findFirst({
        where: { orderId: order.id, status: 'SETTLED' },
        select: { id: true },
      });
      if (existing) return;

      let totalCommission = 0;
      for (const { level, inviterId, rate } of levels) {
        const amount = +(baseAmount * rate).toFixed(2);
        if (amount <= 0) continue;
        totalCommission += amount;

        await tx.commissionRecord.create({
          data: {
            inviterMerchantId: inviterId,
            sourceMerchantId,
            orderId: order.id,
            orderNo: order.orderNo,
            level,
            baseAmount: new Prisma.Decimal(baseAmount),
            rate: new Prisma.Decimal(rate),
            amount: new Prisma.Decimal(amount),
            status: 'SETTLED',
          },
        });

        // source 商户扣减（返佣从商户利润出，允许负数）
        await tx.merchant.update({
          where: { id: sourceMerchantId },
          data: { balance: { decrement: new Prisma.Decimal(amount) } },
        });

        // inviter 商户增加
        await tx.merchant.update({
          where: { id: inviterId },
          data: { balance: { increment: new Prisma.Decimal(amount) } },
        });
      }

      // 邀请码 usedCount++（仅当下单码被使用）
      if (order.usedInviteCode) {
        const invite = await tx.inviteCode.findUnique({
          where: { code: order.usedInviteCode },
          select: { id: true },
        });
        if (invite) {
          await tx.inviteCode.update({
            where: { id: invite.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      }

      this.logger.log(`返佣结算成功: orderNo=${order.orderNo} 共 ${levels.length} 级, 总额 ¥${totalCommission}`);

      // 通知 1级邀请人
      const firstLevel = levels[0]!;
      this.eventEmitter.emit(COMMISSION_EARNED_EVENT, {
        inviterMerchantId: firstLevel.inviterId,
        amount: totalCommission,
        sourceMerchantName: order.shop.merchant.name,
      } satisfies CommissionEarnedPayload);
    });
  }

  // ============== 退款冲正（监听 ORDER_REFUNDED_EVENT）==============

  /**
   * 订单退款时冲正返佣
   * - 查该订单所有 SETTLED 的 CommissionRecord
   * - 邀请人 balance 扣减（允许负数，Q12 决策 b）
   * - source 商户 balance 增加（退回当初扣的返佣）
   * - CommissionRecord.status=REVERSED + reversedAt
   * - 幂等：已 REVERSED 的跳过
   */
  @OnEvent(ORDER_REFUNDED_EVENT)
  async handleOrderRefunded(payload: OrderRefundedPayload): Promise<void> {
    try {
      await this.reverseCommission(payload);
    } catch (err) {
      this.logger.error(`返佣冲正失败 refundNo=${payload.refundNo}: ${(err as Error).message}`);
    }
  }

  private async reverseCommission(payload: OrderRefundedPayload): Promise<void> {
    // 查该订单所有 SETTLED 的返佣记录
    const records = await this.prisma.commissionRecord.findMany({
      where: { orderId: payload.orderId, status: 'SETTLED' },
      select: { id: true, inviterMerchantId: true, sourceMerchantId: true, amount: true, level: true },
    });

    if (records.length === 0) {
      this.logger.debug(`订单 ${payload.orderNo} 无 SETTLED 返佣记录，跳过冲正`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      let totalReversed = 0;
      for (const record of records) {
        // 邀请人 balance 扣减（允许负数，Q12 决策 b）
        await tx.merchant.update({
          where: { id: record.inviterMerchantId },
          data: { balance: { decrement: record.amount } },
        });

        // source 商户 balance 增加（退回当初扣的返佣）
        await tx.merchant.update({
          where: { id: record.sourceMerchantId },
          data: { balance: { increment: record.amount } },
        });

        // CommissionRecord -> REVERSED + reversedAt
        await tx.commissionRecord.update({
          where: { id: record.id },
          data: {
            status: 'REVERSED',
            reversedAt: new Date(),
          },
        });

        totalReversed += Number(record.amount);
      }

      this.logger.log(
        `返佣冲正成功: orderNo=${payload.orderNo} refundNo=${payload.refundNo} 共 ${records.length} 级, 冲正总额 ¥${totalReversed.toFixed(2)}`,
      );
    });
  }

  // ============== 关系链树 ==============

  /** 获取商户的关系链树（下级 + 下级的下级，默认 2 级，最多 3 级） */
  async getInviteTree(
    merchantId: string,
    depth: number = 2,
  ): Promise<{
    root: {
      id: string;
      name: string;
      leaderboardName: string | null;
      invitedAt: Date | null;
      totalGmv: number;
      inviteesCount: number;
    };
    tree: InviteTreeNode[];
  }> {
    const root = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        leaderboardName: true,
        invitedAt: true,
        invitees: { select: { id: true } },
      },
    });
    if (!root) throw new NotFoundException('商户不存在');

    const totalGmv = await this.computeMerchantGmv(merchantId);

    const tree = await this.buildSubTree(merchantId, Math.min(depth, 3));

    return {
      root: {
        id: root.id,
        name: root.name,
        leaderboardName: root.leaderboardName,
        invitedAt: root.invitedAt,
        totalGmv,
        inviteesCount: root.invitees.length,
      },
      tree,
    };
  }

  private async buildSubTree(parentId: string, remainingDepth: number): Promise<InviteTreeNode[]> {
    if (remainingDepth <= 0) return [];
    const children = await this.prisma.merchant.findMany({
      where: { inviterMerchantId: parentId, deletedAt: null },
      select: {
        id: true,
        name: true,
        leaderboardName: true,
        invitedAt: true,
        status: true,
      },
    });
    const result: InviteTreeNode[] = [];
    for (const child of children) {
      const gmv = await this.computeMerchantGmv(child.id);
      const inviteesCount = await this.prisma.merchant.count({
        where: { inviterMerchantId: child.id, deletedAt: null },
      });
      const subTree = await this.buildSubTree(child.id, remainingDepth - 1);
      result.push({
        id: child.id,
        name: child.name,
        leaderboardName: child.leaderboardName,
        invitedAt: child.invitedAt,
        status: child.status,
        totalGmv: gmv,
        inviteesCount,
        children: subTree,
      });
    }
    return result;
  }

  /** 计算商户累计 GMV（所有已支付订单金额） */
  private async computeMerchantGmv(merchantId: string): Promise<number> {
    const result = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        shop: { merchantId },
        status: { in: ['PAID', 'DELIVERED'] },
      },
    });
    return Number(result._sum.totalAmount ?? 0);
  }

  // ============== 排行榜 ==============

  /** Top 10 排行榜（公开，商户名脱敏） */
  async getLeaderboard(
    dimension: 'invites' | 'teamSize' | 'teamGmv',
    period: 'week' | 'month' | 'all',
  ): Promise<{
    items: Array<{ rank: number; displayName: string; value: number }>;
    updatedAt: string;
  }> {
    const cacheKey = `leaderboard:${dimension}:${period}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // 缓存损坏，重新计算
      }
    }
    const result = await this.computeLeaderboard(dimension, period);
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 分钟
    return result;
  }

  /** 自己的排名 + 上下 2 名 */
  async getMyLeaderboard(
    merchantId: string,
    dimension: 'invites' | 'teamSize' | 'teamGmv',
    period: 'week' | 'month' | 'all',
  ): Promise<{
    myRank: number | null;
    myValue: number;
    neighbors: Array<{ rank: number; displayName: string; value: number }>;
  }> {
    const full = await this.computeLeaderboard(dimension, period);
    const myIndex = full.items.findIndex((it: { merchantId?: string }) => it.merchantId === merchantId);
    const myRank = myIndex >= 0 ? myIndex + 1 : null;
    const myValue = myIndex >= 0 ? Number(full.items[myIndex]!.value) : 0;

    // 找上下 2 名
    const neighbors: Array<{ rank: number; displayName: string; value: number }> = [];
    if (myIndex >= 0) {
      for (let offset = -2; offset <= 2; offset++) {
        const idx = myIndex + offset;
        if (idx < 0 || idx >= full.items.length) continue;
        if (offset === 0) continue;
        const item = full.items[idx]!;
        neighbors.push({
          rank: idx + 1,
          displayName: item.displayName,
          value: Number(item.value),
        });
      }
    }
    return { myRank, myValue, neighbors };
  }

  private async computeLeaderboard(
    dimension: 'invites' | 'teamSize' | 'teamGmv',
    period: 'week' | 'month' | 'all',
  ): Promise<{
    items: Array<{
      rank: number;
      merchantId: string;
      displayName: string;
      value: number;
    }>;
    updatedAt: string;
  }> {
    const periodStart = this.getPeriodStart(period);
    // 查所有商户（不删的）
    const merchants = await this.prisma.merchant.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        leaderboardName: true,
        inviterMerchantId: true,
      },
    });

    const items: Array<{ merchantId: string; displayName: string; value: number }> = [];
    for (const m of merchants) {
      let value = 0;
      if (dimension === 'invites') {
        value = await this.prisma.merchant.count({
          where: {
            inviterMerchantId: m.id,
            deletedAt: null,
            invitedAt: periodStart ? { gte: periodStart } : undefined,
          },
        });
      } else if (dimension === 'teamSize') {
        // 团队总人数：递归查 3 级下级
        value = await this.countTeamSize(m.id, periodStart);
      } else if (dimension === 'teamGmv') {
        value = await this.computeTeamGmv(m.id, periodStart);
      }
      if (value > 0) {
        items.push({
          merchantId: m.id,
          displayName: this.displayName(m.name, m.leaderboardName),
          value,
        });
      }
    }

    items.sort((a, b) => b.value - a.value);
    const top = items.slice(0, 10).map((it, idx) => ({
      rank: idx + 1,
      merchantId: it.merchantId,
      displayName: it.displayName,
      value: it.value,
    }));

    return { items: top, updatedAt: new Date().toISOString() };
  }

  private async countTeamSize(merchantId: string, periodStart: Date | null): Promise<number> {
    let count = 0;
    let currentLevel = [merchantId];
    for (let level = 0; level < 3; level++) {
      const next: string[] = [];
      for (const pid of currentLevel) {
        const children = await this.prisma.merchant.findMany({
          where: {
            inviterMerchantId: pid,
            deletedAt: null,
            invitedAt: periodStart ? { gte: periodStart } : undefined,
          },
          select: { id: true },
        });
        count += children.length;
        next.push(...children.map((c) => c.id));
      }
      currentLevel = next;
      if (currentLevel.length === 0) break;
    }
    return count;
  }

  private async computeTeamGmv(merchantId: string, periodStart: Date | null): Promise<number> {
    // 团队 GMV = 3 级下级的 GMV 之和
    let totalGmv = 0;
    let currentLevel = [merchantId];
    for (let level = 0; level < 3; level++) {
      const next: string[] = [];
      for (const pid of currentLevel) {
        const children = await this.prisma.merchant.findMany({
          where: { inviterMerchantId: pid, deletedAt: null },
          select: { id: true },
        });
        for (const c of children) {
          const gmv = await this.prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: {
              shop: { merchantId: c.id },
              status: { in: ['PAID', 'DELIVERED'] },
              createdAt: periodStart ? { gte: periodStart } : undefined,
            },
          });
          totalGmv += Number(gmv._sum.totalAmount ?? 0);
        }
        next.push(...children.map((c) => c.id));
      }
      currentLevel = next;
      if (currentLevel.length === 0) break;
    }
    return totalGmv;
  }

  private getPeriodStart(period: 'week' | 'month' | 'all'): Date | null {
    if (period === 'all') return null;
    const now = new Date();
    if (period === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start;
    }
    if (period === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      return start;
    }
    return null;
  }

  private displayName(name: string, leaderboardName: string | null): string {
    if (leaderboardName) return leaderboardName;
    // 脱敏：首字 + ***
    if (name.length <= 1) return name + '***';
    return name[0]! + '***';
  }

  // ============== 商户分销设置 ==============

  async getSettings(merchantId: string): Promise<{
    allowBuyerInviteCode: boolean;
    leaderboardDisplayMode: string;
    leaderboardName: string | null;
    inviterMerchantId: string | null;
    inviterName: string | null;
    invitedAt: Date | null;
  }> {
    const m = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        allowBuyerInviteCode: true,
        leaderboardDisplayMode: true,
        leaderboardName: true,
        inviterMerchantId: true,
        invitedAt: true,
        inviter: { select: { name: true } },
      },
    });
    if (!m) throw new NotFoundException('商户不存在');
    return {
      allowBuyerInviteCode: m.allowBuyerInviteCode,
      leaderboardDisplayMode: m.leaderboardDisplayMode,
      leaderboardName: m.leaderboardName,
      inviterMerchantId: m.inviterMerchantId,
      inviterName: m.inviter?.name ?? null,
      invitedAt: m.invitedAt,
    };
  }

  async updateSettings(
    merchantId: string,
    dto: {
      allowBuyerInviteCode?: boolean;
      leaderboardDisplayMode?: 'TOP10' | 'TOP10_WITH_NEIGHBORS' | 'OFF';
      leaderboardName?: string | null;
    },
  ): Promise<void> {
    const data: Prisma.MerchantUpdateInput = {};
    if (typeof dto.allowBuyerInviteCode === 'boolean') {
      data.allowBuyerInviteCode = dto.allowBuyerInviteCode;
    }
    if (dto.leaderboardDisplayMode) {
      data.leaderboardDisplayMode = dto.leaderboardDisplayMode;
    }
    if (dto.leaderboardName !== undefined) {
      data.leaderboardName = dto.leaderboardName?.slice(0, 128) || null;
    }
    await this.prisma.merchant.update({ where: { id: merchantId }, data });
  }

  // ============== admin 解绑/改绑邀请关系 ==============

  /**
   * SUPER_ADMIN 改绑/解绑商户的邀请人
   * - 不冲正历史返佣（Q12 决策 A）
   * - 仅对未来新订单生效
   * - 记审计日志
   * - 防自邀：不能绑自己
   * - 防环：不能绑自己的下级（避免成环）
   */
  async adminUpdateInviter(
    merchantId: string,
    newInviterMerchantId: string | null,
    ctx: { userId: string; username: string; ip: string; ua: string },
  ): Promise<{ ok: true; inviterMerchantId: string | null }> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true, inviterMerchantId: true, invitedAt: true },
    });
    if (!merchant) throw new NotFoundException('商户不存在');

    // 防自邀
    if (newInviterMerchantId && newInviterMerchantId === merchantId) {
      throw new BadRequestException('不能邀请自己');
    }

    // 防环：检查 newInviterMerchantId 是否是 merchant 的下级
    if (newInviterMerchantId) {
      const newInviter = await this.prisma.merchant.findUnique({
        where: { id: newInviterMerchantId },
        select: { id: true, name: true },
      });
      if (!newInviter) throw new NotFoundException('新邀请人不存在');

      // 递归向下查 merchant 的所有下级，看 newInviter 是否在其中
      const isChild = await this.isInSubtree(merchantId, newInviterMerchantId);
      if (isChild) {
        throw new BadRequestException('不能绑定自己的下级为邀请人（会成环）');
      }
    }

    const before = {
      inviterMerchantId: merchant.inviterMerchantId,
      invitedAt: merchant.invitedAt,
    };

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        inviterMerchantId: newInviterMerchantId,
        invitedAt: newInviterMerchantId ? new Date() : null,
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'merchant.inviter_update',
      resourceType: 'merchant',
      resourceId: merchantId,
      beforeData: before,
      afterData: {
        inviterMerchantId: newInviterMerchantId,
        invitedAt: newInviterMerchantId ? new Date().toISOString() : null,
      },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(
      `admin 改绑邀请关系: merchant=${merchantId}(${merchant.name}) old=${before.inviterMerchantId ?? 'null'} new=${newInviterMerchantId ?? 'null'} by=${ctx.username}`,
    );

    return { ok: true, inviterMerchantId: newInviterMerchantId };
  }

  /** 检查 targetId 是否是 rootId 的下级（递归查 3 级，防环） */
  private async isInSubtree(rootId: string, targetId: string): Promise<boolean> {
    let currentLevel = [rootId];
    for (let level = 0; level < 3; level++) {
      const next: string[] = [];
      for (const pid of currentLevel) {
        const children = await this.prisma.merchant.findMany({
          where: { inviterMerchantId: pid, deletedAt: null },
          select: { id: true },
        });
        for (const c of children) {
          if (c.id === targetId) return true;
        }
        next.push(...children.map((c) => c.id));
      }
      currentLevel = next;
      if (currentLevel.length === 0) break;
    }
    return false;
  }
}

export interface InviteTreeNode {
  id: string;
  name: string;
  leaderboardName: string | null;
  invitedAt: Date | null;
  status: string;
  totalGmv: number;
  inviteesCount: number;
  children: InviteTreeNode[];
}
