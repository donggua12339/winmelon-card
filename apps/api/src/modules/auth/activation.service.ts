import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthService } from './auth.service';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';

const TOKEN_TTL_HOURS = 48;

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 生成激活 token（48h 一次性）
   * - 返回 raw token（明文）给调用方用于发邮件
   * - 数据库存的是 hash，校验时比对 hash
   */
  async generate(params: {
    email: string;
    userId?: string;
    type?: 'MERCHANT_APPROVE' | 'FORGOT_PASSWORD';
  }): Promise<{ token: string; expiresAt: Date }> {
    const raw = randomBytes(32).toString('hex'); // 64 字符
    const hash = createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 64);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

    await this.prisma.activationToken.create({
      data: {
        token: hash,
        email: params.email,
        userId: params.userId ?? null,
        type: params.type ?? 'MERCHANT_APPROVE',
        expiresAt,
      },
    });

    this.logger.log(
      `生成激活 token email=${params.email} type=${params.type ?? 'MERCHANT_APPROVE'} expiresAt=${expiresAt.toISOString()}`,
    );
    return { token: raw, expiresAt };
  }

  /**
   * 校验 token 是否有效（未过期、未使用）
   */
  async validate(rawToken: string): Promise<{
    id: string;
    email: string;
    userId: string | null;
    type: string;
  }> {
    const hash = createHash('sha256').update(rawToken, 'utf8').digest('hex').slice(0, 64);
    const record = await this.prisma.activationToken.findUnique({
      where: { token: hash },
    });
    if (!record) {
      throw new BadRequestException('激活链接无效');
    }
    if (record.usedAt) {
      throw new BadRequestException('激活链接已被使用');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('激活链接已过期，请联系管理员重新发起');
    }
    return {
      id: record.id,
      email: record.email,
      userId: record.userId,
      type: record.type,
    };
  }

  /**
   * 激活账号：设置密码 + 标记 token 使用
   * - 失败抛 BadRequest（密码太弱等）
   * - 同时调用 authService.changePassword 风格的更新（不走旧密码校验，因为是首次激活）
   */
  async activate(
    rawToken: string,
    newPassword: string,
    ctx: { ip: string; ua: string },
  ): Promise<{ user: User; accessToken: string; expiresIn: number }> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('密码至少 8 位');
    }

    const record = await this.validate(rawToken);

    // 找用户（应该是被审批通过、但没有密码或临时密码的）
    const user = await this.prisma.user.findFirst({
      where: { email: record.email, deletedAt: null },
    });
    if (!user) {
      throw new BadRequestException('用户不存在或已删除');
    }
    if (user.isActive === false) {
      throw new BadRequestException('用户已被禁用');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.activationToken.update({
        where: { id: record.id },
        data: {
          usedAt: new Date(),
          userId: user.id,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          // tokenEpoch +1 吊销旧 refresh token
          tokenEpoch: { increment: 1 },
        },
      }),
    ]);

    await this.auditLog.record({
      actorId: user.id,
      actorName: user.username,
      action: 'auth.activate',
      resourceType: 'user',
      resourceId: user.id,
      afterData: { tokenType: record.type },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    // 自动登录：返回 access token
    const accessTokenResult = await this.authService.issueAccessTokenOnly(user, ctx);
    this.logger.log(`账号激活成功 email=${user.email} userId=${user.id}`);

    // 把 user 信息返回（access token）
    return {
      user,
      accessToken: accessTokenResult.accessToken,
      expiresIn: accessTokenResult.expiresIn,
    };
  }
}
