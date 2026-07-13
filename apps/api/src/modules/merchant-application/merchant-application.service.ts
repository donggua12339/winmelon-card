import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EmailVerificationService } from './email-verification.service';
import { ApplyMerchantDto } from './dto/apply-merchant.dto';

@Injectable()
export class MerchantApplicationService {
  private readonly logger = new Logger(MerchantApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /** 商户入驻申请：验证码通过后自动激活账号 */
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
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.contactEmail },
    });
    if (existingUser) {
      throw new BadRequestException('该邮箱已注册，请直接登录或更换邮箱');
    }

    // 3. 校验验证码（必须先发后用）
    await this.emailVerification.verifyCode(dto.contactEmail, dto.verificationCode);

    // 4. 生成初始密码
    const initPassword = this.generatePassword();
    const passwordHash = await bcrypt.hash(initPassword, 12);

    // 5. 事务：创建 Merchant + Shop + User + 申请记录标记为已通过
    const result = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          name: dto.merchantName,
          code: dto.shopCode,
          contactEmail: dto.contactEmail,
          status: 'ACTIVE',
          commissionRate: 0,
          balance: 0,
        },
      });

      const shop = await tx.shop.create({
        data: {
          merchantId: merchant.id,
          code: dto.shopCode,
          name: dto.shopName,
          isOnline: false,
        },
      });

      const user = await tx.user.create({
        data: {
          username: dto.contactEmail,
          email: dto.contactEmail,
          passwordHash,
          role: 'MERCHANT',
          merchantId: merchant.id,
          isActive: true,
        },
      });

      const app = await tx.merchantApplication.create({
        data: {
          contactEmail: dto.contactEmail,
          merchantName: dto.merchantName,
          shopName: dto.shopName,
          shopCode: dto.shopCode,
          businessScope: dto.businessScope,
          status: 'APPROVED',
          reviewedById: 'system-auto',
          reviewedAt: new Date(),
          approvedMerchantId: merchant.id,
        },
      });

      return { merchant, shop, user, app };
    });

    await this.auditLog.record({
      actorId: result.user.id,
      actorName: dto.contactEmail,
      action: 'merchant.auto_approve',
      resourceType: 'merchant_application',
      resourceId: result.app.id,
      afterData: {
        merchantId: result.merchant.id,
        shopId: result.shop.id,
        method: 'email_verification',
      },
    });

    this.logger.log(`商户自动激活（邮箱验证）: ${result.merchant.name} (${result.merchant.code})`);

    return {
      merchantId: result.merchant.id,
      shopId: result.shop.id,
      username: result.user.username,
      initialPassword: initPassword,
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

  /** 管理员审核通过（兜底用，自动激活后一般用不到） */
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
          reviewedById: adminUser.userId,
          reviewedAt: new Date(),
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

  /** 每 30 分钟清理过期验证码 */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async cleanupExpiredCodes(): Promise<void> {
    const count = await this.emailVerification.cleanupExpired();
    if (count > 0) {
      this.logger.log(`清理 ${count} 条过期验证码`);
    }
  }

  /** 生成 12 位强随机密码（含大小写+数字+特殊字符） */
  private generatePassword(): string {
    const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    pwd += special[Math.floor(Math.random() * special.length)];
    for (let i = 0; i < 8; i++) {
      pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
