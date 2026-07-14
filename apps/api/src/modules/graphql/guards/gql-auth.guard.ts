import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '../../auth/dto/token-payload.interface';

/**
 * GraphQL 鉴权 Guard
 * 从 context.req.headers.authorization 提取 Bearer token
 * 解析 JWT 写入 req.user
 */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录或登录已过期');
    }
    const token = authHeader.slice(7);
    try {
      const payload = this.jwt.verify<TokenPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.type && payload.type !== 'access') {
        throw new UnauthorizedException('令牌类型错误');
      }
      req.user = {
        userId: payload.sub,
        username: payload.username,
        email: payload.email,
        roles: payload.roles,
        merchantId: payload.merchantId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }
}
