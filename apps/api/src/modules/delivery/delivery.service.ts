import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';

/**
 * 自动发卡服务
 * 监听 OrderPaidEvent，事务内：
 * 1. 校验订单状态为 PAID（防重入）
 * 2. 把关联的 LOCKED 卡标记为 SOLD
 * 3. 校验发卡数量与订单商品数量一致（防丢失）
 * 4. 订单 -> DELIVERED
 *
 * 失败时事务回滚，订单保持 PAID，可手动补发
 */
@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @OnEvent(ORDER_PAID_EVENT)
  async handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
    this.logger.log(`收到支付成功事件 orderNo=${payload.orderNo}`);

    try {
      await this.deliver(payload);
    } catch (err) {
      this.logger.error(`自动发卡失败 orderNo=${payload.orderNo}: ${(err as Error).message}`);
      await this.auditLog.record({
        action: 'delivery.failed',
        resourceType: 'order',
        resourceId: payload.orderId,
        afterData: { reason: (err as Error).message, channel: payload.channel },
      });
      // 不抛出，事件已结束；订单保持 PAID 等待手动补发
    }
  }

  /**
   * 手动补发（后台触发）
   * 与自动发卡逻辑一致，仅入口不同
   */
  async manualRetry(
    orderId: string,
    ctx: { actorId?: string; actorName?: string; ip?: string; requestId?: string },
  ): Promise<{ delivered: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNo: true, status: true },
    });
    if (!order) throw new Error('订单不存在');
    if (order.status === 'DELIVERED') {
      throw new Error('订单已发卡，无需补发');
    }
    if (order.status !== 'PAID') {
      throw new Error(`订单状态为 ${order.status}，无法补发`);
    }

    await this.deliver({
      orderId,
      orderNo: order.orderNo,
      paymentId: '',
      channel: 'manual',
      amount: '',
      paidAt: new Date(),
    });

    await this.auditLog.record({
      actorId: ctx.actorId,
      actorName: ctx.actorName,
      action: 'delivery.manual',
      resourceType: 'order',
      resourceId: orderId,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });

    const cards = await this.prisma.stockCard.count({
      where: { orderId, status: 'SOLD' },
    });
    return { delivered: cards };
  }

  private async deliver(payload: OrderPaidPayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. 条件更新订单状态 PAID -> DELIVERED（防重入）
      const updated = await tx.order.updateMany({
        where: { id: payload.orderId, status: 'PAID' },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
      if (updated.count === 0) {
        // 订单非 PAID 状态，可能是已 DELIVERED 或异常状态
        const order = await tx.order.findUnique({
          where: { id: payload.orderId },
          select: { status: true },
        });
        if (order?.status === 'DELIVERED') {
          this.logger.log(`订单 ${payload.orderNo} 已发卡，跳过`);
          return;
        }
        throw new Error(`订单状态异常，无法发卡 status=${order?.status ?? 'null'}`);
      }

      // 2. 把 LOCKED 卡标记 SOLD
      const result = await tx.stockCard.updateMany({
        where: { orderId: payload.orderId, status: 'LOCKED' },
        data: { status: 'SOLD', soldAt: new Date() },
      });

      // 3. 校验发卡数量
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: payload.orderId },
        select: { quantity: true },
      });
      const expected = orderItems.reduce((sum, it) => sum + it.quantity, 0);
      if (result.count !== expected) {
        throw new Error(`发卡数量不匹配 expected=${expected} actual=${result.count}`);
      }

      this.logger.log(`发卡成功 orderNo=${payload.orderNo} count=${result.count}`);
    });

    await this.auditLog.record({
      action: 'delivery.success',
      resourceType: 'order',
      resourceId: payload.orderId,
      afterData: { channel: payload.channel, orderNo: payload.orderNo },
    });
  }
}
