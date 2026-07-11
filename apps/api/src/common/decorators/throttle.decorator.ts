import { SetMetadata } from '@nestjs/common';

export interface ThrottleOptions {
  /** 每分钟允许请求数 */
  perMin: number;
  /** 自定义 key 后缀（默认按路由 + IP） */
  keySuffix?: string;
}

export const THROTTLE_KEY = 'throttle';
export const Throttle = (opts: ThrottleOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(THROTTLE_KEY, opts) as MethodDecorator & ClassDecorator;
