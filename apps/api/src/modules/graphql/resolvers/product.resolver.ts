import { Args, Query, Resolver, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, NotFoundException } from '@nestjs/common';
import { ProductType, ShopType } from '../types/product.type';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

@Resolver(() => ProductType)
export class ProductResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** 按 ID 查商品（需认证） */
  @Query(() => ProductType, { description: '按 ID 查询商品' })
  @UseGuards(GqlAuthGuard)
  async product(@Args('id', { type: () => ID }) id: string): Promise<ProductType> {
    const p = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });
    if (!p) throw new NotFoundException('商品不存在');
    return this.toType(p);
  }

  /** 公开查询：列出某店铺在线商品（带分页） */
  @Query(() => [ProductType], { description: '列出店铺在线商品' })
  async productsByShop(
    @Args('shopCode') shopCode: string,
    @Args('limit', { type: () => Number, defaultValue: 50 }) limit: number,
  ): Promise<ProductType[]> {
    const shop = await this.prisma.shop.findFirst({
      where: { code: shopCode, isOnline: true },
      select: { id: true },
    });
    if (!shop) return [];
    const items = await this.prisma.product.findMany({
      where: { shopId: shop.id, status: 'ONLINE', deletedAt: null },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 100),
    });
    return items.map((p) => this.toType(p));
  }

  @ResolveField(() => ShopType)
  async shop(@Parent() product: ProductType): Promise<ShopType> {
    const s = await this.prisma.shop.findUnique({ where: { id: product.shopId } });
    if (!s) throw new NotFoundException('店铺不存在');
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      announcement: s.announcement ?? undefined,
      customDomain: s.customDomain ?? undefined,
      isOnline: s.isOnline,
      createdAt: s.createdAt,
      merchantId: s.merchantId,
    };
  }

  private toType(p: {
    id: string;
    name: string;
    description: string | null;
    price: { toString(): string };
    originalPrice: { toString(): string | null } | null;
    status: string;
    categoryId: string | null;
    purchaseLimit: number | null;
    isAutoDelivery: boolean;
    sort: number;
    createdAt: Date;
    shopId: string;
  }): ProductType {
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? undefined,
      price: Number(p.price.toString()),
      originalPrice: p.originalPrice ? Number(p.originalPrice.toString()) : undefined,
      status: p.status,
      categoryId: p.categoryId ?? undefined,
      purchaseLimit: p.purchaseLimit ?? undefined,
      isAutoDelivery: p.isAutoDelivery,
      sort: p.sort,
      createdAt: p.createdAt,
      shopId: p.shopId,
    };
  }
}
