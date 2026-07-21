import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, CouponType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** 生成 8 字符券码（base36，去歧义） */
  private generateCode(): string {
    const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += alphabet[bytes[i]! % alphabet.length];
    }
    return code;
  }

  /** admin 创建券 */
  async create(
    params: {
      type: CouponType;
      value: number;
      minSpend?: number;
      validFrom?: Date;
      validTo?: Date;
      usageLimit?: number;
      shopId?: string;
      note?: string;
    },
    ctx: { userId: string; username: string; ip?: string; ua?: string },
  ) {
    // 生成唯一码（重试 5 次）
    let code = '';
    for (let i = 0; i < 5; i++) {
      const candidate = this.generateCode();
      const exists = await this.prisma.coupon.findUnique({ where: { code: candidate } });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new BadRequestException('券码生成失败，请重试');

    if (params.type === 'PERCENT' && (params.value <= 0 || params.value > 100)) {
      throw new BadRequestException('百分比折扣必须在 0-100 之间');
    }
    if (params.type === 'AMOUNT' && params.value <= 0) {
      throw new BadRequestException('固定金额必须大于 0');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: params.type,
        value: new Prisma.Decimal(params.value),
        minSpend: params.minSpend ? new Prisma.Decimal(params.minSpend) : null,
        validFrom: params.validFrom ?? null,
        validTo: params.validTo ?? null,
        usageLimit: params.usageLimit ?? null,
        shopId: params.shopId ?? null,
        note: params.note?.slice(0, 255),
        createdBy: ctx.userId,
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'coupon.create',
      resourceType: 'coupon',
      resourceId: coupon.id,
      afterData: { code, type: params.type, value: params.value, shopId: params.shopId },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`券已创建: ${code} (type=${params.type} value=${params.value})`);
    return coupon;
  }

  /** admin 列表 */
  async list(query: { page: number; pageSize: number }) {
    const where: Prisma.CouponWhereInput = {};
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** admin 删除（软删：物理删，未使用的券可删） */
  async delete(id: string, ctx: { userId: string; username: string; ip?: string; ua?: string }) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('券不存在');
    if (coupon.usedCount > 0) {
      throw new BadRequestException('券已被使用，不能删除（可设过期时间停止使用）');
    }
    await this.prisma.coupon.delete({ where: { id } });
    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'coupon.delete',
      resourceType: 'coupon',
      resourceId: id,
      beforeData: { code: coupon.code },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });
    return { ok: true };
  }

  /** 下单时验证券 + 计算折扣 */
  async validateAndCalculate(
    code: string,
    originalAmount: number,
    shopId: string,
  ): Promise<{ valid: boolean; couponId?: string; discountAmount?: number; reason?: string }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return { valid: false, reason: '券码不存在' };

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) return { valid: false, reason: '券未生效' };
    if (coupon.validTo && now > coupon.validTo) return { valid: false, reason: '券已过期' };
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, reason: '券已达使用上限' };
    }
    if (coupon.shopId && coupon.shopId !== shopId) {
      return { valid: false, reason: '券不适用于当前店铺' };
    }
    if (coupon.minSpend && originalAmount < Number(coupon.minSpend)) {
      return { valid: false, reason: `需满 ¥${Number(coupon.minSpend)} 才可使用` };
    }

    let discount = 0;
    if (coupon.type === 'PERCENT') {
      discount = +((originalAmount * Number(coupon.value)) / 100).toFixed(2);
    } else if (coupon.type === 'AMOUNT') {
      discount = Math.min(Number(coupon.value), originalAmount);
    }

    return { valid: true, couponId: coupon.id, discountAmount: discount };
  }

  /** 订单支付成功后，标记券已使用 */
  async markUsed(couponId: string): Promise<void> {
    await this.prisma.coupon.update({
      where: { id: couponId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
