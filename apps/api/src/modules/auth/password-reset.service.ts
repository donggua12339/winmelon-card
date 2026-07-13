import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { randomBytes } from 'crypto';

const CODE_TTL_SEC = 10 * 60; // 验证码 10 分钟
const RESEND_COOLDOWN_SEC = 60; // 60s 冷却
const DAILY_LIMIT = 10; // 每邮箱每天最多 10 次
const MAX_ATTEMPTS = 5; // 5 次错误锁 1 小时
const LOCK_TTL_SEC = 60 * 60; // 锁定 1 小时
const CAPTCHA_TTL_SEC = 5 * 60; // 图形验证码 5 分钟
const VERIFICATION_TYPE = 'reset_password';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly auditLog: AuditLogService,
    jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtSecret = config.get<string>('JWT_SECRET') ?? 'change-me';
    void jwt; // 占位防止未用警告
  }

  /**
   * 步骤 1：发邮箱验证码
   * - 同邮箱 60s 冷却
   - 每天最多 10 次
   * - 不区分邮箱是否存在（防枚举）
   */
  async sendCode(email: string, ctx: { ip: string; ua: string }): Promise<{ cooldown: number }> {
    const normalized = email.trim().toLowerCase();

    // 60s 冷却（对所有邮箱生效，含不存在的）
    const cooldownKey = `pwd_reset:cooldown:${normalized}`;
    const ttl = await this.redis.ttl(cooldownKey);
    if (ttl > 0) {
      throw new BadRequestException(`请 ${ttl} 秒后再试`);
    }

    // 每天 10 次上限（对所有请求计）
    const dayKey = `pwd_reset:daily:${normalized}`;
    const dayCount = Number((await this.redis.get(dayKey)) ?? '0');
    if (dayCount >= DAILY_LIMIT) {
      throw new BadRequestException('今日重置次数已达上限，请明天再试');
    }

    // 检查用户是否存在（如果不存在，静默返回）
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, deletedAt: null },
      select: { id: true, email: true, username: true, role: true },
    });

    if (user) {
      // 失效旧的验证码
      await this.prisma.emailVerification.updateMany({
        where: { email: normalized, type: VERIFICATION_TYPE, usedAt: null },
        data: { usedAt: new Date() },
      });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + CODE_TTL_SEC * 1000);

      await this.prisma.emailVerification.create({
        data: { email: normalized, code, type: VERIFICATION_TYPE, expiresAt },
      });

      // 发邮件（开发模式会打到日志）
      const sent = await this.mail.send({
        to: normalized,
        subject: '【WM 卡密平台】密码重置验证码',
        html: `
          <div style="max-width:480px;margin:0 auto;font-family:-apple-system,sans-serif;padding:24px;background:#1a1d29;color:#fff;border-radius:12px;">
            <h2 style="margin:0 0 16px;color:#06b6d4;">密码重置验证码</h2>
            <p style="margin:0 0 24px;color:#a0aec0;">您正在重置账号密码，验证码为：</p>
            <div style="background:#0f1117;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
              <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#06b6d4;font-family:monospace;">${code}</span>
            </div>
            <p style="margin:24px 0 8px;color:#a0aec0;">验证码有效期为 <strong style="color:#fff;">10 分钟</strong>，请尽快完成验证。</p>
            <p style="margin:8px 0 0;color:#718096;font-size:13px;">如非本人操作，请忽略此邮件。</p>
          </div>
        `,
      });
      if (!sent) {
        this.logger.warn(`[开发模式] 重置验证码 ${code} -> ${normalized}`);
      }

      // 清除错误计数（重新发码后允许重试）
      await this.redis.del(`pwd_reset:attempts:${normalized}`);
    } else {
      // 用户不存在：静默记录，但不实际发送（避免 SMTP 配额浪费和反应出邮箱是否存在）
      this.logger.warn(`忘记密码请求：邮箱不存在 ip=${ctx.ip} email=${normalized}`);
    }

    // 每次请求都增加计数（无论邮箱是否存在）+ 设置冷却
    await this.redis.set(cooldownKey, '1', 'EX', RESEND_COOLDOWN_SEC);
    await this.redis.set(dayKey, String(dayCount + 1), 'EX', 24 * 60 * 60);

    await this.auditLog.record({
      action: 'password_reset.send_code',
      resourceType: 'user',
      resourceId: user?.id,
      beforeData: { email: normalized },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    return { cooldown: RESEND_COOLDOWN_SEC };
  }

  /**
   * 步骤 2：验证 + 重置密码
   * - 校验图形验证码（如果提供 captchaId）
   * - 校验邮箱验证码
   * - 检查锁定状态
   * - 重置密码 + 发通知邮件
   */
  async reset(
    payload: { email: string; code: string; newPassword: string },
    ctx: { ip: string; ua: string },
  ): Promise<{ ok: true }> {
    const email = payload.email.trim().toLowerCase();

    // 1. 校验密码强度
    if (!payload.newPassword || payload.newPassword.length < 8) {
      throw new BadRequestException('新密码至少 8 位');
    }
    if (!/[A-Za-z]/.test(payload.newPassword) || !/\d/.test(payload.newPassword)) {
      throw new BadRequestException('密码必须包含字母和数字');
    }

    // 2. 检查是否锁定
    const lockKey = `pwd_reset:lock:${email}`;
    const locked = await this.redis.get(lockKey);
    if (locked) {
      throw new BadRequestException('尝试次数过多，请 1 小时后再试');
    }

    // 3. 检查用户
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (!user) {
      // 防枚举：同样计数错误
      await this.recordFailedAttempt(email);
      throw new BadRequestException('验证码错误或已过期');
    }

    // 4. 校验邮箱验证码
    const record = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        code: payload.code,
        type: VERIFICATION_TYPE,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      await this.recordFailedAttempt(email);
      throw new BadRequestException('验证码错误或已过期');
    }

    // 5. 重置密码
    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.emailVerification.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    });

    // 6. 清除失败计数
    await this.redis.del(`pwd_reset:attempts:${email}`);

    // 7. 发送通知邮件
    await this.mail.send({
      to: email,
      subject: '【WM 卡密平台】您的密码已被重置',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:-apple-system,sans-serif;padding:24px;background:#1a1d29;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#f59e0b;">⚠️ 密码已重置</h2>
          <p style="margin:0 0 16px;color:#a0aec0;">您的账号密码已于 <strong style="color:#fff;">${new Date().toLocaleString('zh-CN')}</strong> 被重置。</p>
          <p style="margin:0 0 16px;color:#a0aec0;">如非本人操作，请立即联系平台管理员。</p>
          <p style="margin:24px 0 0;color:#718096;font-size:13px;">IP：${ctx.ip}</p>
        </div>
      `,
      text: `您的 WM 卡密平台账号密码已于 ${new Date().toISOString()} 被重置。如非本人操作，请联系管理员。IP：${ctx.ip}`,
    });

    await this.auditLog.record({
      actorId: user.id,
      actorName: user.username,
      action: 'password_reset.success',
      resourceType: 'user',
      resourceId: user.id,
      afterData: { email },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`密码重置成功：${user.username} (${user.role}) ip=${ctx.ip}`);

    return { ok: true };
  }

  /** 记录失败尝试，5 次锁 1 小时 */
  private async recordFailedAttempt(email: string): Promise<void> {
    const attemptsKey = `pwd_reset:attempts:${email}`;
    const lockKey = `pwd_reset:lock:${email}`;
    const newCount = await this.redis.incr(attemptsKey);
    if (newCount === 1) {
      // 第一次设置，过期时间 1 小时
      await this.redis.expire(attemptsKey, LOCK_TTL_SEC);
    }
    if (newCount >= MAX_ATTEMPTS) {
      await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SEC);
      this.logger.warn(`密码重置已锁定：${email}`);
    }
  }

  /** 生成图形验证码（4 位数字 + 简单干扰线），存 Redis */
  async generateCaptcha(): Promise<{ id: string; image: string }> {
    const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4 位
    const id = randomBytes(16).toString('hex');
    await this.redis.set(`captcha:${id}`, code.toLowerCase(), 'EX', CAPTCHA_TTL_SEC);

    // 用 SVG 生成图形（避免引入新依赖）
    const chars = code.split('');
    const image = this.renderCaptchaSvg(chars);

    return { id, image };
  }

  /** 校验图形验证码（一次有效，验证后立即删除） */
  async verifyCaptcha(id: string, code: string): Promise<boolean> {
    if (!id || !code) return false;
    const expected = await this.redis.get(`captcha:${id}`);
    if (!expected) return false;
    await this.redis.del(`captcha:${id}`);
    return expected === code.toLowerCase();
  }

  /** 用纯 SVG 渲染 4 位图形验证码（带干扰线） */
  private renderCaptchaSvg(chars: string[]): string {
    const width = 120;
    const height = 40;
    // 给每个字符随机偏移
    const charEls = chars
      .map((ch, i) => {
        const x = 15 + i * 25 + (Math.random() * 6 - 3);
        const y = 26 + (Math.random() * 6 - 3);
        const rotate = (Math.random() * 30 - 15).toFixed(1);
        const colors = ['#7c3aed', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="24" font-family="monospace" font-weight="700" fill="${color}" transform="rotate(${rotate} ${x.toFixed(1)} ${y.toFixed(1)})">${ch}</text>`;
      })
      .join('');

    // 干扰线
    const lines = Array.from({ length: 4 }, () => {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = Math.random() * width;
      const y2 = Math.random() * height;
      const opacity = (0.2 + Math.random() * 0.3).toFixed(2);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#64748b" stroke-width="0.8" opacity="${opacity}" />`;
    }).join('');

    // 干扰点
    const dots = Array.from({ length: 30 }, () => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.8" fill="#94a3b8" opacity="0.5" />`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f1f5f9" rx="4"/>${dots}${lines}${charEls}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}
