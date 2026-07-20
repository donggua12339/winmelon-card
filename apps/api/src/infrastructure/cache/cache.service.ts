import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const NULL_SENTINEL = '__NULL__';
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 100;

export interface CacheMetrics {
  hits: number;
  misses: number;
  null_hits: number;
  sets: number;
  deletes: number;
  errors: number;
}

/**
 * M1 缓存层：Redis 写穿透 + 穿透防护 + 失败容忍 + 命中率指标
 *
 * 设计要点（grill-me 12 决策）：
 * - 写穿透：业务 service 在更新 DB 后调 set() 同步写 Redis
 * - 穿透防护：DB 返回空时缓存空值哨兵 + 短 TTL
 * - 失败容忍：Redis 写失败重试 3 次（100ms 间隔），仍失败仅记告警不影响主流程
 * - 读失败容忍：Redis 读失败直接返回 null，让上层走 DB
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly metrics: CacheMetrics = { hits: 0, misses: 0, null_hits: 0, sets: 0, deletes: 0, errors: 0 };
  // 默认 TTL：5 分钟
  private readonly defaultTtlSec: number;
  // 穿透防护：空值短 TTL（60 秒），防恶意查询打 DB
  private readonly nullTtlSec = 60;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.defaultTtlSec = Number(config.get<string>('CACHE_DEFAULT_TTL_SEC', '300'));
  }

  /**
   * 读缓存。返回 null = 缓存未命中/失败/空值
   * - 命中正常值 → 返回反序列化后的对象
   * - 未命中 / Redis 失败 → 返回 null（调用方走 DB）
   * - 命中空值哨兵 → 返回 NULL_SENTINEL 字符串（调用方需识别）
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null || raw === undefined) {
        this.metrics.misses += 1;
        return null;
      }
      if (raw === NULL_SENTINEL) {
        this.metrics.null_hits += 1;
        // 返回特殊标记让调用方区分"DB 也查不到"
        return NULL_SENTINEL as unknown as T;
      }
      this.metrics.hits += 1;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.metrics.errors += 1;
      this.logger.warn(`缓存读取失败 key=${key} ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * 写缓存。失败重试 3 次（100ms 间隔），仍失败仅告警。
   * - ttlSec 不传则用默认 TTL
   * - value 为 null/undefined 时存空值哨兵（防穿透）
   */
  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    const ttl = ttlSec ?? this.defaultTtlSec;
    let raw: string;
    if (value === null || value === undefined) {
      raw = NULL_SENTINEL;
    } else {
      raw = JSON.stringify(value);
    }

    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
      try {
        await this.redis.set(key, raw, 'EX', ttl);
        this.metrics.sets += 1;
        return;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < RETRY_COUNT - 1) {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }
    this.metrics.errors += 1;
    this.logger.error(`缓存写入失败（已重试 ${RETRY_COUNT} 次）key=${key} error=${lastErr?.message}`);
  }

  /**
   * 写穿透快捷方法：value 为 null 时用穿透短 TTL，否则用正常 TTL
   */
  async setWithNullGuard<T>(key: string, value: T, normalTtlSec?: number): Promise<void> {
    const ttl = value === null || value === undefined ? this.nullTtlSec : (normalTtlSec ?? this.defaultTtlSec);
    await this.set(key, value, ttl);
  }

  /**
   * 失效缓存（写操作后调用）
   */
  async invalidate(key: string): Promise<void> {
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
      try {
        await this.redis.del(key);
        this.metrics.deletes += 1;
        return;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < RETRY_COUNT - 1) {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }
    this.metrics.errors += 1;
    this.logger.error(`缓存删除失败（已重试 ${RETRY_COUNT} 次）key=${key} error=${lastErr?.message}`);
  }

  /**
   * 按前缀批量失效（场景：店铺下架所有商品）
   * 使用 SCAN 避免 KEYS 阻塞 Redis
   */
  async invalidateByPrefix(prefix: string): Promise<number> {
    let totalDeleted = 0;
    try {
      let cursor = '0';
      do {
        const result = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await this.redis.del(...keys);
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');
      this.metrics.deletes += totalDeleted;
    } catch (err) {
      this.metrics.errors += 1;
      this.logger.warn(`批量失效缓存失败 prefix=${prefix} ${(err as Error).message}`);
    }
    return totalDeleted;
  }

  /** 获取指标（管理后台用） */
  getMetrics(): CacheMetrics & { hitRate: string } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? ((this.metrics.hits / total) * 100).toFixed(2) + '%' : '0.00%';
    return { ...this.metrics, hitRate };
  }

  /** 重置指标（测试用） */
  resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.null_hits = 0;
    this.metrics.sets = 0;
    this.metrics.deletes = 0;
    this.metrics.errors = 0;
  }

  /** Redis SCAN 返回 [cursor, keys] 元组（ioredis 兼容） */
  private async scan(cursor: string, ...args: Array<string | number>): Promise<[string, string[]]> {
    // ioredis scan 签名：scan(cursor, 'MATCH', pattern, 'COUNT', count)
    // 返回 [nextCursor, keys]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await (this.redis as any).scan(cursor, ...args)) as [string, string[]];
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
