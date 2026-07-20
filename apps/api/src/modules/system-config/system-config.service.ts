import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';

const CONFIG_TTL_SEC = 600; // 10 分钟
const NULL_TTL_SEC = 60;

const NULL_VALUE = '__NULL__' as const;
function isNullSentinel(v: unknown): boolean {
  return v === NULL_VALUE;
}

export interface SystemConfigRecord {
  key: string;
  value: string;
  updatedAt: Date;
}

/**
 * M1 系统配置缓存层
 * - 配置项读取热路径（容差、费率、邀请级别比例）
 * - 写操作后失效缓存（write-through）
 */
@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getValue(key: string): Promise<string | null> {
    const cacheKey = `cache:config:${key}`;
    const cached = await this.cache.get<{ value: string }>(cacheKey);
    if (cached !== null && !isNullSentinel(cached)) {
      return cached.value;
    }
    if (isNullSentinel(cached)) {
      return null;
    }

    const cfg = await this.prisma.systemConfig.findUnique({
      where: { key },
      select: { value: true },
    });
    if (!cfg) {
      await this.cache.setWithNullGuard(cacheKey, null, NULL_TTL_SEC);
      return null;
    }
    await this.cache.set(cacheKey, { value: cfg.value }, CONFIG_TTL_SEC);
    return cfg.value;
  }

  async getNumber(key: string): Promise<number | null> {
    const v = await this.getValue(key);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * 写入 + 失效缓存（写穿透）
   */
  async setValue(key: string, value: string): Promise<SystemConfigRecord> {
    const record = await this.prisma.systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value, updatedAt: new Date() },
    });
    await this.cache.invalidate(`cache:config:${key}`);
    return record;
  }
}
