import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { computeVisitorId, isBotUa } from '../../common/utils/visitor.util';

const DEDUP_WINDOW_SEC = 30 * 60; // 30 分钟内同 visitor 不重复记 UV

@Injectable()
export class PageViewService {
  private readonly logger = new Logger(PageViewService.name);
  private readonly salt: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    // P0-3 v2: 专用 VISITOR_SALT，与 JWT_SECRET 解耦（JWT 轮换不影响历史 UV）
    this.salt = config.get<string>('VISITOR_SALT') ?? 'wm-card-visitor-salt';
  }

  /**
   * 记录一次页面访问
   * - P0-3 v2: Bot UA 在入口直接拒绝（不写 DB、不写 Redis）
   * - 30 分钟内同 visitorId + shopId 只记一次（Redis 去重）
   * - visitorId = sha256(ip + ua + salt) 前 16 字符，不存原始 IP
   */
  async track(params: {
    shopId: string;
    path: string;
    ip: string;
    userAgent?: string;
  }): Promise<{ recorded: boolean; reason?: 'bot' | 'dedup' | 'db_error' }> {
    // Bot 拦截
    if (isBotUa(params.userAgent)) {
      return { recorded: false, reason: 'bot' };
    }

    const visitorId = computeVisitorId(params.ip, params.userAgent ?? '', this.salt);
    const dedupKey = `pv:dedup:${params.shopId}:${visitorId}`;

    // Redis SET NX：30 分钟内首次访问才写 DB
    const set = await this.redis.set(dedupKey, '1', 'EX', DEDUP_WINDOW_SEC, 'NX');
    if (!set) {
      return { recorded: false, reason: 'dedup' };
    }

    try {
      await this.prisma.pageView.create({
        data: {
          shopId: params.shopId,
          path: params.path.slice(0, 255),
          ip: params.ip.slice(0, 64),
          userAgent: params.userAgent?.slice(0, 512) ?? null,
          visitorId,
        },
      });
    } catch (err) {
      // DB 写失败不阻断请求，但要清掉 Redis 让下次能重试
      await this.redis.del(dedupKey).catch(() => undefined);
      this.logger.error(`PageView 写入失败: ${(err as Error).message}`);
      return { recorded: false, reason: 'db_error' };
    }

    return { recorded: true };
  }

  /**
   * 查询某店铺的 UV/PV 统计
   * @param shopId 店铺 ID
   * @param start 起始时间（含）
   * @param end 结束时间（不含）
   */
  async getStats(shopId: string, start: Date, end: Date): Promise<{ uv: number; pv: number }> {
    const [uvRows, pv] = await Promise.all([
      this.prisma.pageView.findMany({
        where: { shopId, createdAt: { gte: start, lt: end } },
        select: { visitorId: true },
        distinct: ['visitorId'],
      }),
      this.prisma.pageView.count({
        where: { shopId, createdAt: { gte: start, lt: end } },
      }),
    ]);
    return { uv: uvRows.length, pv };
  }

  /**
   * 查询某店铺最近 N 天的每日 UV/PV 趋势
   */
  async getDailyTrend(shopId: string, days: number): Promise<Array<{ date: string; uv: number; pv: number }>> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);

    const rows = await this.prisma.pageView.findMany({
      where: { shopId, createdAt: { gte: start } },
      select: { visitorId: true, createdAt: true },
    });

    const dayMap = new Map<string, Set<string>>();
    const pvMap = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, new Set());
      pvMap.set(key, 0);
    }

    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      dayMap.get(key)?.add(r.visitorId);
      pvMap.set(key, (pvMap.get(key) ?? 0) + 1);
    }

    return Array.from(dayMap.entries()).map(([date, visitors]) => ({
      date,
      uv: visitors.size,
      pv: pvMap.get(date) ?? 0,
    }));
  }
}
