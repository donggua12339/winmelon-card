import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { sanitizeRichHtml } from '../../common/utils/sanitize';

const SHOP_TTL_SEC = 600; // 店铺信息 10 分钟
const PRODUCT_TTL_SEC = 300; // 商品 5 分钟
const PRODUCT_LIST_TTL_SEC = 300; // 商品列表 5 分钟
const NULL_TTL_SEC = 60; // 穿透防护空值 TTL

// 空值哨兵：缓存穿透防护
const NULL_VALUE = '__NULL__' as const;
function isNullSentinel(v: unknown): boolean {
  return v === NULL_VALUE;
}

@Injectable()
export class ShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * 买家侧：根据 code 查店铺信息
   * 缓存：cache:shop:basic:{code}
   */
  async findShopByCode(code: string): Promise<{
    id: string;
    code: string;
    name: string;
    announcement: string | null;
    merchantId: string;
  }> {
    const cacheKey = `cache:shop:basic:${code}`;
    const cached = await this.cache.get<{
      id: string;
      code: string;
      name: string;
      announcement: string | null;
      merchantId: string;
    }>(cacheKey);
    if (cached !== null && !isNullSentinel(cached)) {
      return cached;
    }
    if (isNullSentinel(cached)) {
      throw new NotFoundException('店铺不存在或已下线');
    }

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
      await this.cache.setWithNullGuard(cacheKey, null, NULL_TTL_SEC);
      throw new NotFoundException('店铺不存在或已下线');
    }
    await this.cache.set(cacheKey, shop, SHOP_TTL_SEC);
    return shop;
  }

  /**
   * SEO 静态化：查店铺 + 商品（用于 SSR 渲染）
   * 缓存：cache:shop:seo:{code}
   */
  async findShopForSeo(code: string): Promise<NonNullable<Awaited<ReturnType<typeof this.findShopForSeoRaw>>>> {
    const cacheKey = `cache:shop:seo:${code}`;
    const cached = await this.cache.get<NonNullable<Awaited<ReturnType<typeof this.findShopForSeoRaw>>>>(cacheKey);
    if (cached !== null && !isNullSentinel(cached)) {
      return cached;
    }
    if (isNullSentinel(cached)) {
      throw new NotFoundException('店铺不存在或已下线');
    }

    const shop = await this.findShopForSeoRaw(code);
    if (!shop) {
      await this.cache.setWithNullGuard(cacheKey, null, NULL_TTL_SEC);
      throw new NotFoundException('店铺不存在或已下线');
    }
    await this.cache.set(cacheKey, shop, SHOP_TTL_SEC);
    return shop;
  }

  private async findShopForSeoRaw(code: string) {
    return this.prisma.shop.findFirst({
      where: { code, isOnline: true },
      select: {
        id: true,
        code: true,
        name: true,
        announcement: true,
        merchantId: true,
        customDomain: true,
        merchant: {
          select: {
            name: true,
            contactEmail: true,
          },
        },
        products: {
          where: { status: 'ONLINE', deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            originalPrice: true,
          },
          take: 100,
          orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  /**
   * 列出所有在线店铺（用于 sitemap，实时性优先不缓存）
   */
  async listAllOnlineShops() {
    return this.prisma.shop.findMany({
      where: { isOnline: true },
      select: { code: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 商品列表（带分页 + 分类过滤）
   * 缓存键：cache:products:shop:{shopId}:cat:{categoryId|all}:p:{page}:s:{pageSize}
   */
  async listProducts(shopId: string, query: { categoryId?: string; page: number; pageSize: number }) {
    const cacheKey = `cache:products:shop:${shopId}:cat:${query.categoryId ?? 'all'}:p:${query.page}:s:${query.pageSize}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const result = await this.listProductsRaw(shopId, query);
    await this.cache.set(cacheKey, result, PRODUCT_LIST_TTL_SEC);
    return result;
  }

  private async listProductsRaw(shopId: string, query: { categoryId?: string; page: number; pageSize: number }) {
    const where = {
      shopId,
      status: 'ONLINE' as const,
      deletedAt: null,
      stockCards: { some: { status: 'AVAILABLE' as const } },
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
      items: items.map((p) => ({
        ...p,
        price: p.price.toString(),
        originalPrice: p.originalPrice?.toString() ?? null,
        stock: stockMap.get(p.id) ?? 0,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * 商品详情
   * 缓存键：cache:product:{productId}
   */
  async findProductForBuyer(productId: string) {
    const cacheKey = `cache:product:${productId}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached !== null && !isNullSentinel(cached)) {
      return cached;
    }
    if (isNullSentinel(cached)) {
      throw new NotFoundException('商品不存在或已下架');
    }

    const product = await this.findProductForBuyerRaw(productId);
    if (!product) {
      await this.cache.setWithNullGuard(cacheKey, null, NULL_TTL_SEC);
      throw new NotFoundException('商品不存在或已下架');
    }
    await this.cache.set(cacheKey, product, PRODUCT_TTL_SEC);
    return product;
  }

  private async findProductForBuyerRaw(productId: string) {
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
      return null;
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
    if (dto.footerHtml !== undefined)
      data.footerHtml = dto.footerHtml === null ? null : sanitizeRichHtml(dto.footerHtml);
    if (dto.isOnline !== undefined) data.isOnline = dto.isOnline;

    const updated = await this.prisma.shop.update({
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

    // M1 写穿透：店铺变更后失效缓存
    await Promise.all([
      this.cache.invalidate(`cache:shop:basic:${shop.code}`),
      this.cache.invalidate(`cache:shop:seo:${shop.code}`),
    ]);

    return updated;
  }

  /** 公开方法：商品变更后由 product.service 调用失效列表/详情缓存 */
  async invalidateProductsByShopId(shopId: string): Promise<number> {
    return this.cache.invalidateByPrefix(`cache:products:shop:${shopId}:`);
  }

  async invalidateProduct(productId: string): Promise<void> {
    await this.cache.invalidate(`cache:product:${productId}`);
  }
}
