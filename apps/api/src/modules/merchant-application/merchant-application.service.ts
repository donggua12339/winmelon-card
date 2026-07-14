import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { EmailVerificationService } from './email-verification.service';
import { ApplyMerchantDto } from './dto/apply-merchant.dto';

const ACTIVATION_TOKEN_TTL_MIN = 30; // 激活 token 30 分钟过期

@Injectable()
export class MerchantApplicationService {
  private readonly logger = new Logger(MerchantApplicationService.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mail: MailService,
    private readonly emailVerification: EmailVerificationService,
    config: ConfigService,
  ) {
    this.publicBaseUrl = config.get<string>('PUBLIC_BASE_URL', 'http://localhost:5173');
  }

  /** hash token（不存明文） */
  private hashActivationToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /**
   * P2-8: 商户入驻申请（改为发激活链接，不发明文密码）
   * 流程：验证码 → 创建 application + 激活 token → 发邮件 → 用户点击链接设置密码
   */
  async apply(dto: ApplyMerchantDto & { verificationCode: string }) {
    // 1. 校验店铺码唯一
    const existingApp = await this.prisma.merchantApplication.findUnique({
      where: { shopCode: dto.shopCode },
    });
    if (existingApp) {
      throw new BadRequestException(`店铺码 ${dto.shopCode} 已被申请`);
    }
    const existingShop = await this.prisma.shop.findUnique({
      where: { code: dto.shopCode },
    });
    if (existingShop) {
      throw new BadRequestException(`店铺码 ${dto.shopCode} 已存在`);
    }

    // 2. 校验邮箱是否已注册
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.contactEmail, deletedAt: null },
    });
    if (existingUser) {
      throw new BadRequestException('该邮箱已注册，请直接登录或更换邮箱');
    }

    // 3. 校验验证码
    await this.emailVerification.verifyCode(dto.contactEmail, dto.verificationCode);

    // 4. 生成激活 token（明文）+ 存 hash
    const activationToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashActivationToken(activationToken);
    const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MIN * 60 * 1000);

    // 5. 创建申请记录（PENDING 等用户激活）
    const app = await this.prisma.merchantApplication.create({
      data: {
        contactEmail: dto.contactEmail,
        merchantName: dto.merchantName,
        shopName: dto.shopName,
        shopCode: dto.shopCode,
        businessScope: dto.businessScope,
        status: 'PENDING', // 等用户激活
        activationTokenHash: tokenHash,
        activationExpiresAt: expiresAt,
      },
    });

    // 6. 发送激活邮件（不含明文密码）
    const activateUrl = `${this.publicBaseUrl}/activate?token=${activationToken}&app=${app.id}`;
    await this.mail.send({
      to: dto.contactEmail,
      subject: '【WM 卡密平台】激活您的商户账号',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;background:#1a1d29;color:#fff;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#7c3aed;">🎉 申请已提交</h2>
          <p style="margin:0 0 16px;color:#a0aec0;">您的商户入驻申请已收到。点击下方链接在 <strong>${ACTIVATION_TOKEN_TTL_MIN} 分钟内</strong> 设置登录密码：</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${activateUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">激活账号并设置密码</a>
          </p>
          <p style="margin:0 0 8px;color:#718096;font-size:13px;">链接 30 分钟内有效，过期请重新申请。</p>
          <p style="margin:0;color:#718096;font-size:13px;">如非本人操作，请忽略此邮件。</p>
        </div>
      `,
      text: `您的商户入驻申请已收到。点击下方链接在 ${ACTIVATION_TOKEN_TTL_MIN} 分钟内设置登录密码：\n\n${activateUrl}\n\n如非本人操作，请忽略此邮件。`,
    });

    this.logger.log(`商户申请已提交，激活邮件已发送: ${dto.contactEmail}`);

    return {
      applicationId: app.id,
      message: '请在 30 分钟内查收邮件并完成激活',
    };
  }

  /**
   * P2-8: 激活商户账号
   * 验证 token + 设置密码 + 创建 Merchant/Shop/User + 标记 application 为 APPROVED
   */
  async activate(applicationId: string, activationToken: string, password: string, ctx: { ip: string; ua: string }) {
    // 1. 校验密码强度
    if (!password || password.length < 8 || password.length > 64) {
      throw new BadRequestException('密码长度需在 8-64 字符');
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('密码必须包含字母和数字');
    }

    // 2. 查 application + 验证 token
    const app = await this.prisma.merchantApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') {
      throw new BadRequestException('该申请已激活或已处理');
    }
    if (!app.activationTokenHash || !app.activationExpiresAt) {
      throw new BadRequestException('激活链接无效');
    }
    if (app.activationExpiresAt < new Date()) {
      throw new BadRequestException('激活链接已过期，请重新申请');
    }
    if (this.hashActivationToken(activationToken) !== app.activationTokenHash) {
      throw new BadRequestException('激活链接无效');
    }

    // 3. 二次校验：店铺码 / 邮箱是否仍可用
    const existingShop = await this.prisma.shop.findUnique({ where: { code: app.shopCode } });
    if (existingShop) {
      throw new BadRequestException(`店铺码 ${app.shopCode} 已被占用`);
    }
    const existingUser = await this.prisma.user.findFirst({
      where: { email: app.contactEmail, deletedAt: null },
    });
    if (existingUser) {
      throw new BadRequestException('该邮箱已注册，请直接登录');
    }

    // 4. 事务：创建 Merchant + Shop + User + 标记申请通过
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          name: app.merchantName,
          code: app.shopCode,
          contactEmail: app.contactEmail,
          status: 'ACTIVE',
          commissionRate: 0,
          balance: 0,
        },
      });
      const shop = await tx.shop.create({
        data: {
          merchantId: merchant.id,
          code: app.shopCode,
          name: app.shopName,
          isOnline: false,
        },
      });
      const user = await tx.user.create({
        data: {
          username: app.contactEmail,
          email: app.contactEmail,
          passwordHash,
          role: 'MERCHANT',
          merchantId: merchant.id,
          isActive: true,
        },
      });
      await tx.merchantApplication.update({
        where: { id: app.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: user.id,
          approvedMerchantId: merchant.id,
          activatedAt: new Date(),
          activationTokenHash: null,
          activationExpiresAt: null,
        },
      });
      return { merchant, shop, user };
    });

    await this.auditLog.record({
      actorId: result.user.id,
      actorName: app.contactEmail,
      action: 'merchant.activate',
      resourceType: 'merchant_application',
      resourceId: app.id,
      afterData: {
        merchantId: result.merchant.id,
        shopId: result.shop.id,
        method: 'email_activation',
      },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`商户激活成功: ${result.merchant.name} (${result.merchant.code})`);

    return {
      merchantId: result.merchant.id,
      shopId: result.shop.id,
      username: result.user.username,
      loginUrl: `${this.publicBaseUrl}/admin/login`,
    };
  }

  /** 管理员查申请列表 */
  async list(query: { page: number; pageSize: number; status?: string }) {
    const where = query.status ? { status: query.status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {};
    const [items, total] = await Promise.all([
      this.prisma.merchantApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.merchantApplication.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 管理员审核通过（兜底用） */
  async approve(applicationId: string, adminUser: { userId: string; username: string }) {
    const app = await this.prisma.merchantApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') {
      throw new BadRequestException(`申请状态为 ${app.status}，无法审核`);
    }

    const initPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(initPassword, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          name: app.merchantName,
          code: app.shopCode,
          contactEmail: app.contactEmail,
          status: 'ACTIVE',
          commissionRate: 0,
          balance: 0,
        },
      });
      const shop = await tx.shop.create({
        data: {
          merchantId: merchant.id,
          code: app.shopCode,
          name: app.shopName,
          isOnline: false,
        },
      });
      const user = await tx.user.create({
        data: {
          username: app.contactEmail,
          email: app.contactEmail,
          passwordHash,
          role: 'MERCHANT',
          merchantId: merchant.id,
          isActive: true,
        },
      });
      const updated = await tx.merchantApplication.update({
        where: { id: applicationId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: adminUser.userId,
          approvedMerchantId: merchant.id,
        },
      });
      return { merchant, shop, user, updated };
    });

    await this.auditLog.record({
      actorId: adminUser.userId,
      actorName: adminUser.username,
      action: 'merchant.approve',
      resourceType: 'merchant_application',
      resourceId: applicationId,
      afterData: {
        merchantId: result.merchant.id,
        shopId: result.shop.id,
        userId: result.user.id,
      },
    });

    return {
      merchantId: result.merchant.id,
      shopId: result.shop.id,
      username: result.user.username,
      initialPassword: initPassword,
    };
  }

  /** 审核拒绝 */
  async reject(applicationId: string, reason: string, adminUser: { userId: string; username: string }) {
    const app = await this.prisma.merchantApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') {
      throw new BadRequestException(`申请状态为 ${app.status}，无法审核`);
    }

    await this.prisma.merchantApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        rejectReason: reason,
        reviewedById: adminUser.userId,
        reviewedAt: new Date(),
      },
    });

    await this.auditLog.record({
      actorId: adminUser.userId,
      actorName: adminUser.username,
      action: 'merchant.reject',
      resourceType: 'merchant_application',
      resourceId: applicationId,
      afterData: { reason },
    });

    return { ok: true };
  }

  /** 每 30 分钟清理过期的激活 token */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupExpiredCodes(): Promise<void> {
    const count = await this.emailVerification.cleanupExpired();
    if (count > 0) {
      this.logger.log(`清理 ${count} 条过期验证码`);
    }
  }

  /** 生成 12 位强随机密码（含大小写+数字+特殊字符），使用 crypto.randomInt 保证 CSPRNG */
  private generatePassword(): string {
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    const pickFrom = (s: string): string => s.charAt(randomInt(0, s.length));
    let pwd = pickFrom(upper) + pickFrom(lower) + pickFrom(digits) + pickFrom(special);
    for (let i = 0; i < 8; i++) {
      pwd += pickFrom(all);
    }
    // Fisher-Yates 洗牌（CSPRNG 版本）
    const arr = pwd.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr.join('');
  }
}
