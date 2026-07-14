import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { AesGcmService } from '../../infrastructure/crypto/aes-gcm.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
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
    private readonly mail: MailService,
    private readonly crypto: AesGcmService,
    private readonly redis: RedisService,
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
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === 'DELIVERED') {
      throw new BadRequestException('订单已发卡，无需补发');
    }
    if (order.status !== 'PAID') {
      throw new BadRequestException(`订单状态为 ${order.status}，无法补发`);
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
        throw new BadRequestException(`订单状态异常，无法发卡 status=${order?.status ?? 'null'}`);
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
        throw new ConflictException(`发卡数量不匹配 expected=${expected} actual=${result.count}`);
      }

      this.logger.log(`发卡成功 orderNo=${payload.orderNo} count=${result.count}`);
    });

    await this.auditLog.record({
      action: 'delivery.success',
      resourceType: 'order',
      resourceId: payload.orderId,
      afterData: { channel: payload.channel, orderNo: payload.orderNo },
    });

    // 发送卡密邮件（异步，不阻塞主流程）
    // P2-14: 失败时入重试队列（Redis ZSET，score = 下次重试时间戳）
    this.sendDeliveryEmail(payload).catch(async (err) => {
      this.logger.error(`卡密邮件发送失败 orderNo=${payload.orderNo}: ${(err as Error).message}`);
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        select: { id: true, orderNo: true, buyerEmail: true },
      });
      if (!order?.buyerEmail) return;
      const retryAt = Date.now() + 60_000; // 1 分钟后重试
      await this.redis.zadd('email:delivery:retry', retryAt, JSON.stringify({ orderId: order.id, attempt: 1 }));
    });
  }

  /**
   * P2-14: 卡密邮件重试 worker
   * 每分钟扫描 Redis ZSET，取出到期的重试任务
   * 指数退避：1min → 5min → 30min
   * 失败 3 次后入死信队列（需要人工介入）
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryDeliveryEmails(): Promise<void> {
    const now = Date.now();
    // 取出 score <= now 的所有任务（最多 10 个/分钟）
    const tasks = await this.redis.zrangebyscore('email:delivery:retry', 0, now, 'LIMIT', 0, 10);
    for (const taskJson of tasks) {
      const task = JSON.parse(taskJson) as { orderId: string; attempt: number };
      // 先从队列移除（避免重复处理）
      await this.redis.zrem('email:delivery:retry', taskJson);
      try {
        const payload: OrderPaidPayload = {
          orderId: task.orderId,
          orderNo: '',
          paymentId: '',
          channel: 'retry',
          amount: '0',
          paidAt: new Date(),
        };
        // 重新查 orderNo（payload 中空的字段）
        const order = await this.prisma.order.findUnique({
          where: { id: task.orderId },
          select: { orderNo: true },
        });
        if (!order) continue;
        payload.orderNo = order.orderNo;
        await this.sendDeliveryEmail(payload);
        this.logger.log(`卡密邮件重试成功 orderNo=${order.orderNo} attempt=${task.attempt}`);
      } catch {
        if (task.attempt >= 3) {
          // 失败 3 次，入死信
          await this.redis.zadd('email:delivery:dead', now, taskJson);
          this.logger.error(`卡密邮件重试失败 3 次，进入死信队列 orderId=${task.orderId}`);
        } else {
          // 指数退避：1min, 5min, 30min
          const delay = task.attempt === 1 ? 5 * 60_000 : 30 * 60_000;
          const nextRetry = now + delay;
          await this.redis.zadd(
            'email:delivery:retry',
            nextRetry,
            JSON.stringify({ orderId: task.orderId, attempt: task.attempt + 1 }),
          );
          this.logger.warn(
            `卡密邮件重试失败，下次重试在 ${delay / 60_000} 分钟后 orderId=${task.orderId} attempt=${task.attempt + 1}`,
          );
        }
      }
    }
  }

  /** 查询订单关联卡密并发邮件 */
  private async sendDeliveryEmail(payload: OrderPaidPayload): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      select: {
        orderNo: true,
        buyerEmail: true,
        stockCards: {
          where: { status: 'SOLD' },
          select: { contentCiphertext: true, contentIv: true, contentTag: true, product: { select: { name: true } } },
        },
      },
    });
    if (!order || !order.buyerEmail) return;

    const cards = order.stockCards.map((c) => ({
      productName: c.product.name,
      content: this.crypto.decrypt({
        ciphertext: c.contentCiphertext,
        iv: c.contentIv,
        tag: c.contentTag,
      }),
    }));

    await this.mail.sendCardDelivery({
      to: order.buyerEmail,
      orderNo: order.orderNo,
      cards,
    });
  }
}
