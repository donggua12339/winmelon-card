import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { JwtRequestUser } from '../../modules/auth/jwt.strategy';

/**
 * 角色守卫
 * 与 JwtAuthGuard 链式使用，要求请求已通过鉴权
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtRequestUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('无权访问');
    }
    const has = user.roles.some((role) => requiredRoles.includes(role));
    if (!has) {
      throw new ForbiddenException('权限不足');
    }
    return true;
  }
}
