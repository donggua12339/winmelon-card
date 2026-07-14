import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import type { JwtRequestUser } from '../../auth/jwt.strategy';

/**
 * GraphQL 角色守卫
 * 与 GqlAuthGuard 链式使用，校验 @Roles 装饰器声明的角色
 * 配套使用：@UseGuards(GqlAuthGuard, GqlRolesGuard) + @Roles('MERCHANT')
 */
@Injectable()
export class GqlRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext<{ req: { user?: JwtRequestUser } }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('未登录');
    }
    const has = user.roles.some((role) => requiredRoles.includes(role));
    if (!has) {
      throw new ForbiddenException(`需要 ${requiredRoles.join('/')} 角色`);
    }
    return true;
  }
}
