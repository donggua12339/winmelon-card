import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { User, UserRole } from '@prisma/client';
import type { TokenPayload } from './dto/token-payload.interface';
import type { LoginResult } from './dto/login-result.interface';
import { getDefaultRedirect } from './dto/login-result.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly auditLog: AuditLogService,
  ) {
    this.accessExpiresIn = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    this.refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  async login(
    username: string,
    password: string,
    ctx: { ip: string; userAgent?: string; requestId?: string },
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await this.auditLog.record({
        actorName: username,
        action: 'login.failed',
        resourceType: 'user',
        resourceId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      throw new UnauthorizedException('用户名或密码错误');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditLog.record({
      actorId: user.id,
      actorName: user.username,
      action: 'login.success',
      resourceType: 'user',
      resourceId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return this.issueTokens(user, ctx);
  }

  async refresh(
    refreshToken: string,
    ctx: { ip: string; userAgent?: string; requestId?: string },
  ): Promise<LoginResult> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('刷新令牌格式错误');
    }

    // 校验 jti 是否在白名单
    const stored = await this.redis.get(`refresh:${payload.jti}`);
    if (!stored || stored !== payload.sub) {
      throw new UnauthorizedException('刷新令牌已失效');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户已被禁用');
    }

    // 校验 tokenEpoch：改密/角色变更后旧 token 立即失效
    if (payload.epoch !== undefined && payload.epoch !== user.tokenEpoch) {
      await this.redis.del(`refresh:${payload.jti}`);
      throw new UnauthorizedException('凭证已失效，请重新登录');
    }

    // 旋转：旧令牌失效
    await this.redis.del(`refresh:${payload.jti}`);
    return this.issueTokens(user, ctx);
  }

  async logout(userId: string, jti?: string): Promise<void> {
    if (jti) {
      await this.redis.del(`refresh:${jti}`);
    }
    await this.auditLog.record({
      actorId: userId,
      action: 'logout',
      resourceType: 'user',
      resourceId: userId,
    });
    this.logger.log(`用户登出 userId=${userId}`);
  }

  /** 修改当前登录用户密码 */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    ctx: { ip: string; userAgent?: string },
  ): Promise<{ ok: true }> {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('原密码和新密码不能为空');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('新密码至少 8 位');
    }
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new BadRequestException('用户不存在');
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('原密码错误');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        // tokenEpoch +1 使所有旧 refresh token 立即失效（强制重新登录）
        tokenEpoch: { increment: 1 },
      },
    });

    // 吊销所有 refresh token：通过 tokenEpoch 自动失效，无需遍历 Redis key

    await this.auditLog.record({
      actorId: userId,
      actorName: user.username,
      action: 'auth.password.change',
      resourceType: 'user',
      resourceId: userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    this.logger.log(`用户修改密码 userId=${userId}`);
    return { ok: true };
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
    });
  }

  private async issueTokens(user: User, _ctx: { ip: string; userAgent?: string }): Promise<LoginResult> {
    const roles = [user.role];
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      merchantId: user.merchantId ?? undefined,
      type: 'access',
      epoch: user.tokenEpoch,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.accessExpiresIn,
    });

    const jti = randomBytes(16).toString('hex');
    const refreshPayload: TokenPayload = {
      ...payload,
      jti,
      type: 'refresh',
    };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.refreshExpiresIn,
    });

    // refresh token 白名单：jti → userId，与 JWT 自身过期一致
    const refreshTtlMs = this.parseExpiryToMs(this.refreshExpiresIn);
    await this.redis.set(`refresh:${jti}`, user.id, 'PX', refreshTtlMs);

    const expiresInSec = Math.floor(this.parseExpiryToMs(this.accessExpiresIn) / 1000);
    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSec,
      defaultRedirect: getDefaultRedirect(roles),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
        merchantId: user.merchantId ?? undefined,
      },
    };
  }

  private parseExpiryToMs(expr: string): number {
    const m = /^(\d+)([smhd])$/.exec(expr);
    if (!m) return 900_000; // 兜底 15min
    const num = Number(m[1]);
    const unit = m[2];
    switch (unit) {
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      default:
        return 900_000;
    }
  }

  /**
   * P2-8: 仅签发 access token（用于账号激活后自动登录）
   * 不签发 refresh token，不写 Redis 白名单
   * 调用方需通过 cookie 重新 login 后才有 refresh
   */
  async issueAccessTokenOnly(
    user: User,
    _ctx: { ip: string; userAgent?: string },
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const roles = [user.role];
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles,
      merchantId: user.merchantId ?? undefined,
      type: 'access',
      epoch: user.tokenEpoch,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.accessExpiresIn,
    });
    const expiresIn = Math.floor(this.parseExpiryToMs(this.accessExpiresIn) / 1000);
    return { accessToken, expiresIn };
  }
}

// 避免 TS 抱怨未使用
export type { UserRole };
