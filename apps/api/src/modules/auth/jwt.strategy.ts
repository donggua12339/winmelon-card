import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { TokenPayload } from '../dto/token-payload.interface';
import { AuthService } from '../auth.service';

export interface JwtRequestUser {
  userId: string;
  username: string;
  email: string;
  roles: string[];
  merchantId?: string;
  jti?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: TokenPayload): Promise<JwtRequestUser> {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('令牌类型错误');
    }
    const user = await this.authService.validateUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }
    return {
      userId: payload.sub,
      username: payload.username,
      email: payload.email,
      roles: payload.roles,
      merchantId: payload.merchantId,
      jti: payload.jti,
    };
  }
}
