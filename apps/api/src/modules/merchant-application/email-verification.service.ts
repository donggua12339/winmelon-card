import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MailService } from '../../infrastructure/mail/mail.service';

const CODE_TTL_SEC = 10 * 60; // 验证码有效期 10 分钟
const RESEND_COOLDOWN_SEC = 60; // 同邮箱 60 秒内只能发一次
const VERIFICATION_TYPE = 'merchant_apply';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  /**
   * 生成并发送 6 位验证码
   * - 冷却时间 60s（Redis 限流）
   * - 10 分钟有效（DB expiresAt）
   * - 旧的未使用验证码标记为已用（只保留最新一个）
   */
  async sendCode(email: string): Promise<{ cooldown: number }> {
    // Redis 限流：同邮箱 60s 内只能发一次
    const cooldownKey = `email_verify:cooldown:${email}`;
    const ttl = await this.redis.ttl(cooldownKey);
    if (ttl > 0) {
      throw new BadRequestException(`请 ${ttl} 秒后再试`);
    }

    // 生成 6 位数字
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + CODE_TTL_SEC * 1000);

    // 旧验证码标记为已用（一个邮箱同时只有一个有效验证码）
    await this.prisma.emailVerification.updateMany({
      where: { email, type: VERIFICATION_TYPE, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.emailVerification.create({
      data: {
        email,
        code,
        type: VERIFICATION_TYPE,
        expiresAt,
      },
    });

    // 发送邮件（如果未配置 MailService，则仅记录日志，开发环境也能拿到验证码）
    const sent = await this.mail.send({
      to: email,
      subject: '【WM 卡密平台】商户入驻验证码',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#1a1d29;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#06b6d4;">商户入驻验证码</h2>
          <p style="margin:0 0 24px;color:#a0aec0;">您好，您的入驻申请验证码为：</p>
          <div style="background:#0f1117;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#06b6d4;font-family:monospace;">${code}</span>
          </div>
          <p style="margin:24px 0 8px;color:#a0aec0;">验证码有效期为 <strong style="color:#fff;">10 分钟</strong>，请尽快完成验证。</p>
          <p style="margin:8px 0 0;color:#718096;font-size:13px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `,
    });

    if (!sent) {
      // 邮件未配置：开发模式下打印到日志
      this.logger.warn(`[开发模式] 验证码 ${code} -> ${email}`);
    }

    // 设置冷却（即便邮件没发出去也限流，防止暴力刷码）
    await this.redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SEC);

    return { cooldown: RESEND_COOLDOWN_SEC };
  }

  /**
   * 校验验证码，成功后标记为已用
   * 返回 true/false，校验失败抛 BadRequest
   */
  async verifyCode(email: string, code: string): Promise<void> {
    const record = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        code,
        type: VERIFICATION_TYPE,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('验证码错误或已过期');
    }

    await this.prisma.emailVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  /** 清理过期验证码（每 30 分钟跑一次） */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.emailVerification.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    return result.count;
  }
}
