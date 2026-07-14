import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type RedisOptions } from 'ioredis';
import { randomBytes } from 'crypto';

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
   * 原子性取锁（SETNX + 过期时间）
   * 返回 token（非 null）表示获取成功，调用方需用同一 token 释放
   * 返回 null 表示锁已被占用
   */
  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = randomBytes(16).toString('hex');
    const result = await this.set(key, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * 释放锁（Lua 脚本原子校验+删除）
   * 仅当 key 的值等于 token 时才删除，避免误删别人的锁
   * 返回 true 表示成功释放，false 表示锁已过期或被别人持有
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    const result = await this.eval(lua, 1, key, token);
    return result === 1;
  }
}
