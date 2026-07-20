import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly cache: CacheService,
  ) {}

  async create(merchantId: string, shopId: string, dto: CreateProductDto, ctx: AuditCtx) {
    // 校验店铺归属
    await this.assertShopOwned(merchantId, shopId);

    const product = await this.prisma.product.create({
      data: {
        shopId,
        merchantId,
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        originalPrice: dto.originalPrice ? new Prisma.Decimal(dto.originalPrice) : null,
        categoryId: dto.categoryId,
        purchaseLimit: dto.purchaseLimit,
        isAutoDelivery: dto.isAutoDelivery ?? true,
        sort: dto.sort ?? 0,
        seekallTier: dto.seekallTier ?? null,
        status: 'OFFLINE', // 默认下架，需手动上架
      },
    });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'product.create',
      resourceType: 'product',
      resourceId: product.id,
      afterData: { name: product.name, price: product.price.toString(), shopId },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    return this.serialize(product);
  }

  async update(merchantId: string, id: string, dto: UpdateProductDto, ctx: AuditCtx) {
    const before = await this.assertProductOwned(merchantId, id);
    const beforeShopId = before.shopId;

    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.originalPrice !== undefined) data.originalPrice = new Prisma.Decimal(dto.originalPrice);
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.purchaseLimit !== undefined) data.purchaseLimit = dto.purchaseLimit;
    if (dto.isAutoDelivery !== undefined) data.isAutoDelivery = dto.isAutoDelivery;
    if (dto.sort !== undefined) data.sort = dto.sort;
    if (dto.seekallTier !== undefined) data.seekallTier = dto.seekallTier;

    const after = await this.prisma.product.update({ where: { id }, data });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'product.update',
      resourceType: 'product',
      resourceId: id,
      beforeData: { name: before.name, price: before.price.toString() },
      afterData: { name: after.name, price: after.price.toString() },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    // M1 写穿透：商品变更后失效缓存
    await this.cache.invalidate(`cache:product:${id}`);
    await this.cache.invalidateByPrefix(`cache:products:shop:${beforeShopId}:`);

    return this.serialize(after);
  }

  async updateStatus(merchantId: string, id: string, status: 'ONLINE' | 'OFFLINE', ctx: AuditCtx) {
    const before = await this.assertProductOwned(merchantId, id);

    if (status === 'ONLINE') {
      // 上架前校验库存
      const available = await this.prisma.stockCard.count({
        where: { productId: id, status: 'AVAILABLE' },
      });
      if (available === 0) {
        throw new ConflictException('库存为 0，无法上架');
      }
    }

    const after = await this.prisma.product.update({
      where: { id },
      data: { status },
    });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: `product.${status === 'ONLINE' ? 'online' : 'offline'}`,
      resourceType: 'product',
      resourceId: id,
      beforeData: { status: before.status },
      afterData: { status: after.status },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    // M1 写穿透：上下架影响列表缓存
    await this.cache.invalidateByPrefix(`cache:products:shop:${before.shopId}:`);

    return this.serialize(after);
  }

  async delete(merchantId: string, id: string, ctx: AuditCtx) {
    const before = await this.assertProductOwned(merchantId, id);

    // 校验是否存在未完成订单引用
    const pendingItems = await this.prisma.orderItem.count({
      where: {
        productId: id,
        order: { status: { in: ['PENDING', 'PAID'] } },
      },
    });
    if (pendingItems > 0) {
      throw new ConflictException('存在未完成订单，无法删除商品');
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'OFFLINE' },
    });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'product.delete',
      resourceType: 'product',
      resourceId: id,
      beforeData: { name: before.name },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    // M1 写穿透：删除商品后失效缓存
    await this.cache.invalidate(`cache:product:${id}`);
    await this.cache.invalidateByPrefix(`cache:products:shop:${before.shopId}:`);
  }

  async list(merchantId: string | undefined, query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };
    if (merchantId) {
      where.merchantId = merchantId;
    }
    if (query.keyword) {
      where.name = { contains: query.keyword };
    }
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    // 批量查询库存数
    const productIds = items.map((p) => p.id);
    const stockCounts = await this.prisma.stockCard.groupBy({
      by: ['productId', 'status'],
      where: { productId: { in: productIds } },
      _count: { _all: true },
    });
    const stockMap = new Map<string, { available: number; locked: number; sold: number }>();
    for (const sc of stockCounts) {
      const entry = stockMap.get(sc.productId) ?? { available: 0, locked: 0, sold: 0 };
      if (sc.status === 'AVAILABLE') entry.available = sc._count._all;
      else if (sc.status === 'LOCKED') entry.locked = sc._count._all;
      else if (sc.status === 'SOLD') entry.sold = sc._count._all;
      stockMap.set(sc.productId, entry);
    }

    return {
      items: items.map((p) => ({
        ...p,
        price: p.price.toString(),
        originalPrice: p.originalPrice?.toString() ?? null,
        stock: stockMap.get(p.id) ?? { available: 0, locked: 0, sold: 0 },
      })),
      total,
      page,
      pageSize,
    };
  }

  async findOne(merchantId: string | undefined, id: string) {
    const where: Prisma.ProductWhereInput = { id, deletedAt: null };
    if (merchantId) where.merchantId = merchantId;
    const product = await this.prisma.product.findFirst({ where });
    if (!product) {
      throw new NotFoundException('商品不存在');
    }
    return {
      ...product,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() ?? null,
    };
  }

  private async assertShopOwned(merchantId: string, shopId: string): Promise<void> {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, merchantId } });
    if (!shop) {
      throw new ForbiddenException('无权操作该店铺');
    }
  }

  private async assertProductOwned(merchantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, merchantId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('商品不存在');
    }
    return product;
  }

  /** 统一序列化：Decimal -> string，避免前端收到 {s,e,d} 对象 */
  private serialize(p: {
    id: string;
    shopId: string;
    merchantId: string;
    categoryId: string | null;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    originalPrice: Prisma.Decimal | null;
    status: string;
    purchaseLimit: number | null;
    isAutoDelivery: boolean;
    sort: number;
    seekallTier: 'TRIAL' | 'MONTHLY' | 'LIFETIME' | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: p.id,
      shopId: p.shopId,
      merchantId: p.merchantId,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      originalPrice: p.originalPrice?.toString() ?? null,
      status: p.status,
      purchaseLimit: p.purchaseLimit,
      isAutoDelivery: p.isAutoDelivery,
      sort: p.sort,
      seekallTier: p.seekallTier,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt,
    };
  }
}

export interface AuditCtx {
  actorId?: string;
  actorName?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}
