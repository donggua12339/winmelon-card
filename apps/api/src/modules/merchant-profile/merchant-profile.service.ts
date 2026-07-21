import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { PageViewService } from '../page-view/page-view.service';
import type { TokenPayload } from '../auth/dto/token-payload.interface';
import { getDefaultRedirect, type LoginResult } from '../auth/dto/login-result.interface';
import { computeVisitorId } from '../../common/utils/visitor.util';

const THEME_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** 漏斗步骤（3 个 UV + 3 个转化率，1 位小数） */
export interface FunnelStep {
  uv: number;
  orderUv: number;
  paidUv: number;
  visitToOrderRate: number;
  orderToPayRate: number;
  overallRate: number;
}

/** 保留 1 位小数（用于转化率展示） */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

@Injectable()
export class MerchantProfileService {
  private readonly logger = new Logger(MerchantProfileService.name);
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly config: ConfigService;
  private readonly visitorSalt: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly redis: RedisService,
    private readonly pageView: PageViewService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.config = config;
    this.accessExpiresIn = config.get<string>('JWT_EXPIRES_IN', '15m');
    this.refreshExpiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    this.visitorSalt = config.get<string>('JWT_SECRET') ?? 'wm-card-salt';
  }

  /** 获取商户工作台配置（店铺信息 + 主题色） */
  async getProfile(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        code: true,
        name: true,
        contactEmail: true,
        themeColor: true,
        status: true,
        createdAt: true,
        shops: {
          select: {
            id: true,
            code: true,
            name: true,
            customDomain: true,
            domainVerified: true,
          },
        },
      },
    });
    if (!merchant) throw new NotFoundException('商户不存在');

    return {
      id: merchant.id,
      code: merchant.code,
      name: merchant.name,
      contactEmail: merchant.contactEmail,
      status: merchant.status,
      themeColor: merchant.themeColor,
      shops: merchant.shops,
      createdAt: merchant.createdAt,
    };
  }

  /** 修改主题色 */
  async setTheme(merchantId: string, color: string, ctx: { userId: string; ip: string; ua: string }) {
    if (!THEME_REGEX.test(color)) {
      throw new BadRequestException('主题色格式不正确（如 #7c3aed 或 #abc）');
    }
    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: { themeColor: color },
    });
    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'merchant.theme.set',
      resourceType: 'merchant',
      resourceId: merchantId,
      afterData: { themeColor: color },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });
    return { themeColor: color };
  }

  /** 修改自己的登录密码 */
  async changePassword(
    merchantId: string,
    userId: string,
    payload: { oldPassword: string; newPassword: string },
    ctx: { ip: string; ua: string },
  ) {
    if (!payload.oldPassword || !payload.newPassword) {
      throw new BadRequestException('原密码和新密码不能为空');
    }
    if (payload.newPassword.length < 8) {
      throw new BadRequestException('新密码至少 8 位');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, merchantId },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const ok = await bcrypt.compare(payload.oldPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('原密码错误');

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.auditLog.record({
      actorId: userId,
      actorName: user.username,
      action: 'merchant.password.change',
      resourceType: 'user',
      resourceId: userId,
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    return { ok: true };
  }

  /** 商户工作台数据看板（只算自己店铺；可按 shopId 筛选单店铺） */
  async getDashboardStats(merchantId: string, shopId?: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // P2-7: 按 shopId 筛选单店铺；不传则查商户所有店铺
    let shopIds: string[];
    if (shopId) {
      // 校验 shopId 归属当前商户
      const shop = await this.prisma.shop.findFirst({
        where: { id: shopId, merchantId },
        select: { id: true },
      });
      if (!shop) throw new ForbiddenException('店铺不存在或无权操作');
      shopIds = [shopId];
    } else {
      const shops = await this.prisma.shop.findMany({
        where: { merchantId },
        select: { id: true },
      });
      shopIds = shops.map((s) => s.id);
    }

    const [todayOrders, todayPaid, monthPaid, pendingOrders, totalOrders, totalRevenueRaw, topProducts, orderTrend] =
      await Promise.all([
        this.prisma.order.count({
          where: { shopId: { in: shopIds }, createdAt: { gte: todayStart } },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          _count: true,
          where: { shopId: { in: shopIds }, status: 'PAID', paidAt: { gte: todayStart } },
        }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          _count: true,
          where: { shopId: { in: shopIds }, status: 'PAID', paidAt: { gte: monthStart } },
        }),
        this.prisma.order.count({
          where: { shopId: { in: shopIds }, status: 'PENDING' },
        }),
        this.prisma.order.count({
          where: { shopId: { in: shopIds } },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            order: { shopId: { in: shopIds } },
            status: 'SUCCESS',
            paidAt: { gte: monthStart },
          },
        }),
        this.prisma.$queryRaw<Array<{ productId: string; productName: string; sold: number; revenue: number }>>`
        SELECT oi.productId, oi.productName,
               SUM(oi.quantity) AS sold,
               SUM(oi.quantity * oi.unitPrice) AS revenue
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.orderId
        INNER JOIN shops s ON s.id = o.shopId
        WHERE s.merchantId = ${merchantId}
          AND o.status IN ('PAID','DELIVERED')
          AND o.paidAt >= ${monthStart}
        GROUP BY oi.productId, oi.productName
        ORDER BY revenue DESC
        LIMIT 5
      `,
        // 最近 7 天每日订单数
        this.prisma.$queryRaw<Array<{ date: string; count: number; revenue: number }>>`
        SELECT DATE(o.createdAt) AS date,
               COUNT(*) AS count,
               COALESCE(SUM(CASE WHEN o.status IN ('PAID','DELIVERED') THEN o.totalAmount ELSE 0 END), 0) AS revenue
        FROM orders o
        INNER JOIN shops s ON s.id = o.shopId
        WHERE s.merchantId = ${merchantId}
          AND o.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(o.createdAt)
        ORDER BY date ASC
      `,
      ]);

    // P0-3 UV 统计：今日 UV、昨日 UV、7 日每日 UV 趋势
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    let todayUv = 0;
    let yesterdayUv = 0;
    let uvTrend7d: Array<{ date: string; uv: number; pv: number }> = [];

    if (shopIds.length > 0) {
      const [todayStats, yesterdayStats] = await Promise.all([
        this.prisma.pageView.findMany({
          where: { shopId: { in: shopIds }, createdAt: { gte: todayStart } },
          select: { visitorId: true },
          distinct: ['visitorId'],
        }),
        this.prisma.pageView.findMany({
          where: { shopId: { in: shopIds }, createdAt: { gte: yesterdayStart, lt: todayStart } },
          select: { visitorId: true },
          distinct: ['visitorId'],
        }),
      ]);
      todayUv = todayStats.length;
      yesterdayUv = yesterdayStats.length;

      // 7 日 UV 趋势
      const uvRows = await this.prisma.pageView.findMany({
        where: { shopId: { in: shopIds }, createdAt: { gte: sevenDaysAgo } },
        select: { visitorId: true, createdAt: true },
      });
      const uvDayMap = new Map<string, Set<string>>();
      const pvDayMap = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        uvDayMap.set(key, new Set());
        pvDayMap.set(key, 0);
      }
      for (const r of uvRows) {
        const key = r.createdAt.toISOString().slice(0, 10);
        uvDayMap.get(key)?.add(r.visitorId);
        pvDayMap.set(key, (pvDayMap.get(key) ?? 0) + 1);
      }
      uvTrend7d = Array.from(uvDayMap.entries()).map(([date, visitors]) => ({
        date,
        uv: visitors.size,
        pv: pvDayMap.get(date) ?? 0,
      }));
    }

    // 转化率 = 今日支付订单数 / 今日 UV
    const conversionRate = todayUv > 0 ? Math.round((todayPaid._count / todayUv) * 100) : 0;

    // P0-3 增强：转化漏斗（UV → 下单 → 支付），按 visitorId 归因
    // 24h per-order 归因、新/回访拆分、Top 3 产品、7 日 mini funnel
    const conversionFunnel = await this.computeAdvancedFunnel(merchantId, shopIds, sevenDaysAgo);

    // 复购率：统计本月已支付订单中，相同 email 出现 ≥2 次的比例
    const buyerStats = await this.prisma.$queryRaw<Array<{ buyerEmail: string; cnt: number }>>`
      SELECT o.buyerEmail, COUNT(*) AS cnt
      FROM orders o
      INNER JOIN shops s ON s.id = o.shopId
      WHERE s.merchantId = ${merchantId}
        AND o.status IN ('PAID','DELIVERED')
        AND o.paidAt >= ${monthStart}
      GROUP BY o.buyerEmail
    `;
    const totalBuyers = buyerStats.length;
    const repeatBuyers = buyerStats.filter((b) => Number(b.cnt) >= 2).length;
    const repurchaseRate = totalBuyers > 0 ? Math.round((repeatBuyers / totalBuyers) * 100) : 0;

    return {
      today: {
        orders: todayOrders,
        paidOrders: todayPaid._count,
        revenue: Number(todayPaid._sum.totalAmount ?? 0),
        uv: todayUv,
        conversionRate,
      },
      yesterday: {
        uv: yesterdayUv,
      },
      month: {
        paidOrders: monthPaid._count,
        revenue: Number(monthPaid._sum.totalAmount ?? 0),
        grossRevenue: Number(totalRevenueRaw._sum.amount ?? 0),
      },
      pendingOrders,
      totalOrders,
      repurchaseRate,
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        sold: Number(p.sold),
        revenue: Number(p.revenue),
      })),
      trend7d: orderTrend.map((t) => ({
        date: t.date,
        orders: Number(t.count),
        revenue: Number(t.revenue),
      })),
      uvTrend7d,
      conversionFunnel,
    };
  }

  /**
   * P0-3 v2 转化漏斗（近 7 天）
   *
   * 设计要点（grill-me 12 决策）：
   * 1. 24h per-order 归因：订单 .createdAt 前 24h 内有同 visitorId 的 page_view 才算归因
   * 2. 支付 UV 仅算 PAID + DELIVERED（REFUNDED 不算）
   * 3. 新/回访拆分：visitorId 在 since 之前有过任何访问 = 回访
   * 4. Top 3 产品：按订单数取前 3，各走一遍漏斗
   * 5. 7 日 mini funnel：按 createdAt 日期分桶，每天独立
   */
  private async computeAdvancedFunnel(
    _merchantId: string,
    shopIds: string[],
    since: Date,
  ): Promise<{
    total: FunnelStep;
    byNewReturning: { new: FunnelStep; returning: FunnelStep };
    byProduct: Array<{
      productId: string;
      productName: string;
      sold: number;
      funnel: FunnelStep;
    }>;
    daily: Array<FunnelStep & { date: string }>;
  }> {
    const empty: FunnelStep = { uv: 0, orderUv: 0, paidUv: 0, visitToOrderRate: 0, orderToPayRate: 0, overallRate: 0 };
    if (shopIds.length === 0) {
      return { total: empty, byNewReturning: { new: empty, returning: empty }, byProduct: [], daily: [] };
    }

    // 拉数据：8 天 page_views（含 24h 归因窗口缓冲）+ 7 天订单 + since 前的历史访问
    const lookbackStart = new Date(since.getTime() - 24 * 60 * 60 * 1000);
    const [pageViews, orders, orderItems, historicalVisits] = await Promise.all([
      this.prisma.pageView.findMany({
        where: { shopId: { in: shopIds }, createdAt: { gte: lookbackStart } },
        select: { visitorId: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        where: { shopId: { in: shopIds }, createdAt: { gte: since } },
        select: {
          id: true,
          buyerIp: true,
          buyerUserAgent: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.orderItem.findMany({
        where: { order: { shopId: { in: shopIds }, createdAt: { gte: since } } },
        select: { orderId: true, productId: true, productName: true },
      }),
      // 历史访问：since 之前的所有 page_view，用于判断"回访"
      this.prisma.pageView.findMany({
        where: { shopId: { in: shopIds }, createdAt: { lt: since } },
        select: { visitorId: true },
        distinct: ['visitorId'],
      }),
    ]);

    // 按 visitorId 索引 page_view 时间戳（用于 24h 归因检查）
    const pvTimesByVisitor = new Map<string, number[]>();
    for (const pv of pageViews) {
      const arr = pvTimesByVisitor.get(pv.visitorId) ?? [];
      arr.push(pv.createdAt.getTime());
      pvTimesByVisitor.set(pv.visitorId, arr);
    }
    for (const arr of pvTimesByVisitor.values()) {
      arr.sort((a, b) => a - b);
    }

    // 7 日窗口内的 UV set
    const totalUvSet = new Set<string>();
    for (const pv of pageViews) {
      if (pv.createdAt.getTime() >= since.getTime()) {
        totalUvSet.add(pv.visitorId);
      }
    }

    // 历史 visitorId set（since 之前有访问过的 = 回访）
    const historicalVisitorSet = new Set(historicalVisits.map((v) => v.visitorId));

    // 订单 → visitorId 映射 + 归因检查
    type AttributedOrder = {
      orderId: string;
      visitorId: string;
      isPaid: boolean;
      createdAt: Date;
      isAttributed: boolean;
    };

    const PAID_STATUSES = new Set(['PAID', 'DELIVERED']);

    const attributedOrders: AttributedOrder[] = [];
    for (const o of orders) {
      const vid = computeVisitorId(o.buyerIp, o.buyerUserAgent ?? '', this.visitorSalt);
      const visits = pvTimesByVisitor.get(vid) ?? [];
      const orderTime = o.createdAt.getTime();
      // 24h per-order 归因：orderTime - 24h <= visit < orderTime
      let isAttributed = false;
      for (const t of visits) {
        if (t >= orderTime - 24 * 60 * 60 * 1000 && t < orderTime) {
          isAttributed = true;
          break;
        }
      }
      attributedOrders.push({
        orderId: o.id,
        visitorId: vid,
        isPaid: PAID_STATUSES.has(o.status),
        createdAt: o.createdAt,
        isAttributed,
      });
    }

    // ============== 总漏斗 ==============
    const attributedOrderUv = new Set(attributedOrders.filter((o) => o.isAttributed).map((o) => o.visitorId));
    const attributedPaidUv = new Set(
      attributedOrders.filter((o) => o.isAttributed && o.isPaid).map((o) => o.visitorId),
    );

    const total: FunnelStep = {
      uv: totalUvSet.size,
      orderUv: attributedOrderUv.size,
      paidUv: attributedPaidUv.size,
      visitToOrderRate: round1((attributedOrderUv.size / Math.max(totalUvSet.size, 1)) * 100),
      orderToPayRate: round1((attributedPaidUv.size / Math.max(attributedOrderUv.size, 1)) * 100),
      overallRate: round1((attributedPaidUv.size / Math.max(totalUvSet.size, 1)) * 100),
    };

    // ============== 新/回访拆分 ==============
    const newUv = new Set<string>();
    const returningUv = new Set<string>();
    for (const vid of totalUvSet) {
      if (historicalVisitorSet.has(vid)) returningUv.add(vid);
      else newUv.add(vid);
    }

    const buildSegmentFunnel = (uvSet: Set<string>): FunnelStep => {
      const seg = attributedOrders.filter((o) => o.isAttributed && uvSet.has(o.visitorId));
      const oUv = new Set(seg.map((o) => o.visitorId));
      const pUv = new Set(seg.filter((o) => o.isPaid).map((o) => o.visitorId));
      return {
        uv: uvSet.size,
        orderUv: oUv.size,
        paidUv: pUv.size,
        visitToOrderRate: round1((oUv.size / Math.max(uvSet.size, 1)) * 100),
        orderToPayRate: round1((pUv.size / Math.max(oUv.size, 1)) * 100),
        overallRate: round1((pUv.size / Math.max(uvSet.size, 1)) * 100),
      };
    };

    const byNewReturning = {
      new: buildSegmentFunnel(newUv),
      returning: buildSegmentFunnel(returningUv),
    };

    // ============== Top 3 产品漏斗 ==============
    const productStats = new Map<string, { productName: string; sold: number }>();
    for (const it of orderItems) {
      const cur = productStats.get(it.productId) ?? { productName: it.productName, sold: 0 };
      cur.sold += 1;
      cur.productName = it.productName;
      productStats.set(it.productId, cur);
    }
    const topProducts = Array.from(productStats.entries())
      .sort((a, b) => b[1].sold - a[1].sold)
      .slice(0, 3);

    const orderToProducts = new Map<string, string[]>();
    for (const it of orderItems) {
      const arr = orderToProducts.get(it.orderId) ?? [];
      arr.push(it.productId);
      orderToProducts.set(it.orderId, arr);
    }

    const byProduct = topProducts.map(([productId, stat]) => {
      const productOrders = attributedOrders.filter(
        (o) => o.isAttributed && (orderToProducts.get(o.orderId) ?? []).includes(productId),
      );
      const oUv = new Set(productOrders.map((o) => o.visitorId));
      const pUv = new Set(productOrders.filter((o) => o.isPaid).map((o) => o.visitorId));
      return {
        productId,
        productName: stat.productName,
        sold: stat.sold,
        funnel: {
          uv: totalUvSet.size,
          orderUv: oUv.size,
          paidUv: pUv.size,
          visitToOrderRate: round1((oUv.size / Math.max(totalUvSet.size, 1)) * 100),
          orderToPayRate: round1((pUv.size / Math.max(oUv.size, 1)) * 100),
          overallRate: round1((pUv.size / Math.max(totalUvSet.size, 1)) * 100),
        },
      };
    });

    // ============== 7 日 mini funnel ==============
    type DailyBucket = { uvSet: Set<string>; orderSet: Set<string>; paidSet: Set<string> };
    const dailyMap = new Map<string, DailyBucket>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { uvSet: new Set(), orderSet: new Set(), paidSet: new Set() });
    }
    for (const pv of pageViews) {
      if (pv.createdAt.getTime() < since.getTime()) continue;
      const key = pv.createdAt.toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) bucket.uvSet.add(pv.visitorId);
    }
    for (const o of attributedOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (!bucket) continue;
      if (o.isAttributed) {
        bucket.orderSet.add(o.visitorId);
        if (o.isPaid) bucket.paidSet.add(o.visitorId);
      }
    }

    const daily = Array.from(dailyMap.entries()).map(([date, b]) => ({
      date,
      uv: b.uvSet.size,
      orderUv: b.orderSet.size,
      paidUv: b.paidSet.size,
      visitToOrderRate: round1((b.orderSet.size / Math.max(b.uvSet.size, 1)) * 100),
      orderToPayRate: round1((b.paidSet.size / Math.max(b.orderSet.size, 1)) * 100),
      overallRate: round1((b.paidSet.size / Math.max(b.uvSet.size, 1)) * 100),
    }));

    return { total, byNewReturning, byProduct, daily };
  }

  /** 平台管理员代登录：生成 5 分钟过期的商户会话 token */
  async impersonate(adminCtx: { userId: string; ip: string; ua: string }, targetMerchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: targetMerchantId },
      select: {
        id: true,
        name: true,
        status: true,
        users: {
          where: { role: 'MERCHANT', isActive: true },
          select: { id: true, username: true, email: true },
          take: 1,
        },
      },
    });
    if (!merchant) throw new NotFoundException('商户不存在');
    if (merchant.status !== 'ACTIVE') {
      throw new BadRequestException('商户未激活，无法代登录');
    }
    const targetUser = merchant.users[0];
    if (!targetUser) throw new BadRequestException('商户无活跃管理员账号');

    // 生成短期 token（5 分钟过期）
    const token = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;
    const ttl = 5 * 60; // 5 分钟

    // 存 Redis：token -> { merchantId, userId, adminId }
    await this.redis.set(
      `impersonate:${token}`,
      JSON.stringify({
        merchantId: merchant.id,
        userId: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        adminId: adminCtx.userId,
        createdAt: Date.now(),
      }),
      'EX',
      ttl,
    );

    await this.auditLog.record({
      actorId: adminCtx.userId,
      action: 'merchant.impersonate',
      resourceType: 'merchant',
      resourceId: merchant.id,
      afterData: {
        targetUserId: targetUser.id,
        tokenPrefix: token.slice(0, 16),
        ttlSeconds: ttl,
      },
      ip: adminCtx.ip,
      userAgent: adminCtx.ua,
    });

    this.logger.warn(`代登录 token 已生成：admin=${adminCtx.userId} -> merchant=${merchant.id} (${merchant.name})`);

    return {
      token,
      expiresIn: ttl,
      merchantId: merchant.id,
      merchantName: merchant.name,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
      },
    };
  }

  /** 验证代登录 token 并签发完整登录态（一次性，验证后立即失效） */
  async consumeImpersonateToken(token: string): Promise<LoginResult> {
    const key = `impersonate:${token}`;
    const stored = await this.redis.get(key);
    if (!stored) {
      throw new BadRequestException('代登录链接已失效，请重新申请');
    }
    // 一次性消费：立即删除
    await this.redis.del(key);

    const data = JSON.parse(stored) as {
      merchantId: string;
      userId: string;
      username: string;
      email: string;
      adminId: string;
      createdAt: number;
    };

    // 校验目标用户仍存在且有效
    const user = await this.prisma.user.findFirst({
      where: { id: data.userId, isActive: true, deletedAt: null },
    });
    if (!user) throw new BadRequestException('目标用户已禁用，请重新申请代登录');

    // 签发真实 token（复用 auth 的 token 结构）
    const roles = ['MERCHANT'];
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      merchantId: data.merchantId,
      type: 'access',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.accessExpiresIn,
    });

    const jti = randomBytes(16).toString('hex');
    const refreshPayload: TokenPayload = {
      ...payload,
      jti,
      type: 'refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.refreshExpiresIn,
    });
    const refreshTtlMs = this.parseExpiry(this.refreshExpiresIn);
    await this.redis.set(`refresh:${jti}`, user.id, 'PX', refreshTtlMs);

    await this.auditLog.record({
      actorId: data.adminId,
      action: 'merchant.impersonate.consume',
      resourceType: 'merchant',
      resourceId: data.merchantId,
      afterData: { targetUserId: data.userId },
    });

    this.logger.warn(`代登录 token 已消费：admin=${data.adminId} -> merchant=${data.merchantId}`);

    const expiresInSec = Math.floor(this.parseExpiry(this.accessExpiresIn) / 1000);
    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSec,
      defaultRedirect: getDefaultRedirect(roles),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        merchantId: data.merchantId,
      },
    };
  }

  private parseExpiry(expr: string): number {
    const m = /^(\d+)([smhd])$/.exec(expr);
    if (!m) return 900_000;
    const num = Number(m[1]);
    const unit = m[2];
    switch (unit) {
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      default:
        return 900_000;
    }
  }

  /** 每小时清理过期的 impersonate token（防御性，Redis 也会自动过期） */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupImpersonateTokens(): Promise<void> {
    // Redis 自动 EX 过期，这里只是占位防止误删
  }
}
