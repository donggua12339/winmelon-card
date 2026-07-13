import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ApplyMerchantDto } from './dto/apply-merchant.dto';

@Injectable()
export class MerchantApplicationService {
  private readonly logger = new Logger(MerchantApplicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** 商户入驻申请（公开） */
  async apply(dto: ApplyMerchantDto) {
    // 校验 shopCode 唯一（申请表 + 已有 shop 表）
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

    // 校验邮箱是否已注册
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.contactEmail },
    });
    if (existingUser) {
      throw new BadRequestException('该邮箱已注册，请更换');
    }

    const app = await this.prisma.merchantApplication.create({
      data: {
        contactEmail: dto.contactEmail,
        merchantName: dto.merchantName,
        shopName: dto.shopName,
        shopCode: dto.shopCode,
        businessScope: dto.businessScope,
      },
    });

    this.logger.log(`新商户申请: ${app.merchantName} / ${app.shopCode}`);
    return { id: app.id, status: app.status };
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

  /** 审核通过：创建 Merchant + Shop + User */
  async approve(applicationId: string, adminUser: { userId: string; username: string }) {
    const app = await this.prisma.merchantApplication.findUnique({
      where: { id: applicationId },
    });
    if (!app) throw new NotFoundException('申请不存在');
    if (app.status !== 'PENDING') {
      throw new BadRequestException(`申请状态为 ${app.status}，无法审核`);
    }

    // 生成初始密码
    const initPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
    const passwordHash = await bcrypt.hash(initPassword, 12);

    // 事务：创建 Merchant + Shop + User + 更新申请
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 创建 Merchant
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

      // 2. 创建 Shop
      const shop = await tx.shop.create({
        data: {
          merchantId: merchant.id,
          code: app.shopCode,
          name: app.shopName,
          isOnline: false, // 默认下线，商户自己上架
        },
      });

      // 3. 创建商户管理员 User
      const user = await tx.user.create({
        data: {
          username: app.contactEmail, // 用邮箱作用户名
          email: app.contactEmail,
          passwordHash,
          role: 'MERCHANT',
          merchantId: merchant.id,
          isActive: true,
        },
      });

      // 4. 更新申请状态
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

    this.logger.log(`商户审核通过: ${result.merchant.name} (管理员 ${adminUser.username})`);

    return {
      merchantId: result.merchant.id,
      shopId: result.shop.id,
      username: result.user.username,
      initialPassword: initPassword, // 仅返回一次
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

    this.logger.log(`商户申请拒绝: ${applicationId} (原因: ${reason})`);
    return { ok: true };
  }
}
