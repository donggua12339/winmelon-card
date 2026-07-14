import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

/**
 * GraphQL 鉴权 + 角色守卫（合并鉴权 + 角色检查）
 * 继承 AuthGuard('jwt') 复用 Passport JWT 策略
 * handleRequest 校验 user 存在 + @Roles 装饰器声明的角色
 * 用法：@UseGuards(GqlAuthGuard) + @Roles('MERCHANT')
 */
@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /** 把 GraphQL context.req 映射到 Express req（Passport JWT 策略需要） */
  override getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext<{ req: unknown }>().req as never;
  }

  /** Passport 验证完成后做角色校验 */
  override handleRequest<TUser = unknown>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (err || !user) {
      throw (err as Error | undefined) ?? new UnauthorizedException('未登录或登录已过期');
    }
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const u = user as { roles?: string[] };
      const has = (u.roles ?? []).some((r) => requiredRoles.includes(r));
      if (!has) {
        throw new ForbiddenException(`需要 ${requiredRoles.join('/')} 角色`);
      }
    }
    return user;
  }
}
