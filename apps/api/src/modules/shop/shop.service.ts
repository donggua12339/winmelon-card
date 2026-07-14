import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { sanitizeRichHtml } from '../../common/utils/sanitize';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 买家侧：根据 code 查店铺信息 + 在线商品列表
   */
  async findShopByCode(code: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { code, isOnline: true },
      select: {
        id: true,
        code: true,
        name: true,
        announcement: true,
        merchantId: true,
      },
    });
    if (!shop) {
      throw new NotFoundException('店铺不存在或已下线');
    }
    return shop;
  }

  async listProducts(shopId: string, query: { categoryId?: string; page: number; pageSize: number }) {
    const where = {
      shopId,
      status: 'ONLINE' as const,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          originalPrice: true,
          purchaseLimit: true,
          categoryId: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // 批量查询库存数（仅 AVAILABLE）
    const productIds = items.map((p) => p.id);
    const stockCounts = await this.prisma.stockCard.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, status: 'AVAILABLE' },
      _count: { _all: true },
    });
    const stockMap = new Map<string, number>();
    for (const sc of stockCounts) {
      stockMap.set(sc.productId, sc._count._all);
    }

    return {
      items: items
        .map((p) => ({
          ...p,
          price: p.price.toString(),
          originalPrice: p.originalPrice?.toString() ?? null,
          stock: stockMap.get(p.id) ?? 0,
        }))
        // 过滤掉库存为 0 的商品（买家侧不展示）
        .filter((p) => p.stock > 0),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findProductForBuyer(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ONLINE', deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        originalPrice: true,
        purchaseLimit: true,
        shopId: true,
        shop: { select: { code: true, name: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('商品不存在或已下架');
    }
    return {
      ...product,
      price: product.price.toString(),
      originalPrice: product.originalPrice?.toString() ?? null,
    };
  }

  // ====== 后台管理 ======

  /** SUPER_ADMIN 列出所有店铺 */
  async listAllShops() {
    const items = await this.prisma.shop.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        merchantId: true,
        isOnline: true,
        customDomain: true,
        createdAt: true,
        merchant: {
          select: {
            id: true,
            code: true,
            name: true,
            contactEmail: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  async findMyShop(merchantId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { merchantId },
      select: {
        id: true,
        code: true,
        name: true,
        announcement: true,
        footerHtml: true,
        isOnline: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!shop) {
      throw new NotFoundException('店铺不存在');
    }
    return shop;
  }

  async updateShop(
    merchantId: string,
    shopId: string,
    dto: { name?: string; announcement?: string | null; footerHtml?: string | null; isOnline?: boolean },
  ) {
    const shop = await this.prisma.shop.findFirst({ where: { id: shopId, merchantId } });
    if (!shop) {
      throw new NotFoundException('店铺不存在或无权操作');
    }

    const data: { name?: string; announcement?: string | null; footerHtml?: string | null; isOnline?: boolean } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.announcement !== undefined) data.announcement = dto.announcement;
    // footerHtml 白名单过滤，防止商户注入 <script> 等危险标签
    if (dto.footerHtml !== undefined)
      data.footerHtml = dto.footerHtml === null ? null : sanitizeRichHtml(dto.footerHtml);
    if (dto.isOnline !== undefined) data.isOnline = dto.isOnline;

    return this.prisma.shop.update({
      where: { id: shopId },
      data,
      select: {
        id: true,
        code: true,
        name: true,
        announcement: true,
        footerHtml: true,
        isOnline: true,
        updatedAt: true,
      },
    });
  }
}
