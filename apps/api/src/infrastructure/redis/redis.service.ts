import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type RedisOptions } from 'ioredis';

@Injectable()
export class RedisService extends IORedis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    const opts: RedisOptions = url ? (url as RedisOptions) : { host: '127.0.0.1', port: 6379 };
    super(opts);
    this.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.on('connect', () => this.logger.log('Redis connected'));
  }

  onModuleDestroy(): void {
    this.disconnect();
  }

  /**
   * 原子性取锁（基于 SETNX + 过期时间）
   * 返回 true 表示获取成功，需要在调用方 finally 中释放
   */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.set(key, '1', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }
}
