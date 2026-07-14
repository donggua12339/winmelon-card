import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { UseGuards, NotFoundException } from '@nestjs/common';
import { OrderType } from '../types/order.type';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';

@Resolver(() => OrderType)
export class OrderResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** 当前登录商户的订单（仅返回当前用户的订单） */
  @Query(() => [OrderType], { description: '当前登录商户的订单列表' })
  @UseGuards(GqlAuthGuard)
  async myOrders(
    @Context() ctx: { req: Record<string, unknown> },
    @Args('limit', { type: () => Number, defaultValue: 20 }) limit: number,
  ): Promise<OrderType[]> {
    const merchantId = ctx.req.user?.merchantId;
    if (!merchantId) throw new NotFoundException('当前用户未绑定商户');
    const orders = await this.prisma.order.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            unitPrice: true,
            subtotal: true,
            quantity: true,
          },
        },
      },
    });
    return orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      buyerEmail: o.buyerEmail,
      buyerContact: o.buyerContact ?? undefined,
      paidAt: o.paidAt ?? undefined,
      deliveredAt: o.deliveredAt ?? undefined,
      expireAt: o.expireAt,
      createdAt: o.createdAt,
      shopId: o.shopId,
      items: o.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        unitPrice: Number(it.unitPrice),
        subtotal: Number(it.subtotal),
        quantity: it.quantity,
      })),
    }));
  }

  /** 公开查询：按订单号 + 邮箱查订单（用于买家查询） */
  @Query(() => OrderType, { description: '按订单号 + 邮箱查订单' })
  async orderByNo(@Args('orderNo') orderNo: string, @Args('buyerEmail') buyerEmail: string): Promise<OrderType> {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, buyerEmail },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            unitPrice: true,
            subtotal: true,
            quantity: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      buyerEmail: order.buyerEmail,
      buyerContact: order.buyerContact ?? undefined,
      paidAt: order.paidAt ?? undefined,
      deliveredAt: order.deliveredAt ?? undefined,
      expireAt: order.expireAt,
      createdAt: order.createdAt,
      shopId: order.shopId,
      items: order.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        unitPrice: Number(it.unitPrice),
        subtotal: Number(it.subtotal),
        quantity: it.quantity,
      })),
    };
  }
}
