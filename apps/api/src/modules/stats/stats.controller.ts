import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('admin-stats')
@Controller('admin/stats')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  /** 7/14/30 天订单 + GMV 趋势 */
  @Get('trend')
  async trend(@Query('days') days?: string) {
    const n = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = new Date(Date.now() - n * 86400_000);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true, totalAmount: true },
    });

    // 按日期聚合
    const buckets = new Map<string, { count: number; gmv: number }>();
    for (const o of orders) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(d) ?? { count: 0, gmv: 0 };
      b.count++;
      if (o.status === 'PAID' || o.status === 'DELIVERED') {
        b.gmv += Number(o.totalAmount);
      }
      buckets.set(d, b);
    }

    // 填充空日期
    const result: { date: string; orders: number; gmv: number }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      const b = buckets.get(d) ?? { count: 0, gmv: 0 };
      result.push({ date: d, orders: b.count, gmv: Number(b.gmv.toFixed(2)) });
    }

    return { days: n, series: result };
  }

  /** 商品销量排行 */
  @Get('top-products')
  async topProducts(@Query('days') days?: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(days) || 7, 1), 90);
    const lim = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const since = new Date(Date.now() - n * 86400_000);

    const items = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since }, status: { in: ['PAID', 'DELIVERED'] } } },
      select: { productName: true, quantity: true, subtotal: true },
    });

    const map = new Map<string, { quantity: number; revenue: number }>();
    for (const it of items) {
      const e = map.get(it.productName) ?? { quantity: 0, revenue: 0 };
      e.quantity += it.quantity;
      e.revenue += Number(it.subtotal);
      map.set(it.productName, e);
    }

    return Array.from(map.entries())
      .map(([name, v]) => ({ name, quantity: v.quantity, revenue: Number(v.revenue.toFixed(2)) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, lim);
  }

  /** 状态分布 */
  @Get('order-status')
  async orderStatus(@Query('days') days?: string) {
    const n = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = new Date(Date.now() - n * 86400_000);

    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });

    return grouped.map((g) => ({ status: g.status, count: g._count._all }));
  }
}
