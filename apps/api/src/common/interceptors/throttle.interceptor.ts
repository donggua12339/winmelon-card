import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { THROTTLE_KEY, type ThrottleOptions } from '../decorators/throttle.decorator';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * 限流拦截器
 * - 默认路由无 @Throttle 装饰器时不限流（由 Nginx 全局限速兜底）
 * - 命中 @Throttle 时按 (路由模板 + IP) 做固定窗口计数
 * - 路由模板优先用 NestJS 路由 path（含 :id 参数），避免 RESTful 路径绕过限流
 */
@Injectable()
export class ThrottleInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ThrottleInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const opts = this.reflector.getAllAndOverride<ThrottleOptions | undefined>(THROTTLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!opts) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & { route?: { path?: string } }>();
    // IP 优先用 req.ip（受 trust proxy 配置影响），兜底 socket remoteAddress
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    // 路由模板：优先用 Express 路由 path（含 :id），避免 /orders/123 和 /orders/456 被当作不同 key
    const route = `${req.method}:${req.route?.path ?? req.path}`;
    const key = `throttle:${opts.keySuffix ?? route}:${ip}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      // 首次访问设置 60s 过期
      await this.redis.expire(key, 60);
    }
    if (count > opts.perMin) {
      this.logger.warn(`限流触发 ${key} count=${count} limit=${opts.perMin}`);
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: '请求过于频繁，请稍后再试',
          retryAfter: 60,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return next.handle();
  }
}
