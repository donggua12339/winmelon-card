import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * JWT 守卫
 * - 公开路由（@Public）放行
 * - 其余路由要求 Bearer token 合法
 * - 错误统一抛 UnauthorizedException，避免泄露用户存在性
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  override handleRequest<TUser>(err: unknown, user: TUser | undefined): TUser {
    if (err || !user) {
      throw new UnauthorizedException('未登录或登录已过期');
    }
    return user;
  }
}
