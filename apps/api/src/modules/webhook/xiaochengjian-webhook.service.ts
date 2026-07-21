import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';

/**
 * 小城笺 Webhook 触发器（ADR 0076 - 独立开发者的私有应用攻防与遗产维护工具）
 *
 * 监听订单支付成功事件,若订单包含小城笺会员商品(xcjTier 非空),
 * 主动 POST 到小城笺后端,小城笺验证签名后生成会员权益。
 *
 * 约定:
 * - 失败不阻塞订单(只记日志),小城笺端有幂等,补单可手动
 * - HTTP 超时 5 秒
 * - 签名: HMAC-SHA256(secret, "${wmOrderId}|${xcjTier}|${amount}"),amount 为字符串(如 "18" 而非 "18.00")
 * - 与 SeekAll webhook 互斥(同一商品不会同时有 seekallTier 和 xcjTier)
 */
@Injectable()
export class XiaochengjianWebhookService {
  private readonly logger = new Logger(XiaochengjianWebhookService.name);
  private readonly webhookUrl: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.webhookUrl = this.config.get<string>('XCJ_WEBHOOK_URL');
    this.webhookSecret = this.config.get<string>('XCJ_WEBHOOK_SECRET');
  }

  @OnEvent(ORDER_PAID_EVENT)
  async handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
    try {
      if (!this.webhookUrl || !this.webhookSecret) {
        this.logger.debug('小城笺 webhook 未配置(XCJ_WEBHOOK_URL/XCJ_WEBHOOK_SECRET),跳过');
        return;
      }

      // 查订单的 OrderItem -> Product,找第一个 xcjTier 非空的商品
      const items = await this.prisma.orderItem.findMany({
        where: { orderId: payload.orderId },
        select: {
          quantity: true,
          product: { select: { xcjTier: true, name: true } },
        },
      });

      const xcjItem = items.find((it) => it.product.xcjTier !== null);
      if (!xcjItem) {
        // 非小城笺商品,不触发
        return;
      }

      const tier = xcjItem.product.xcjTier!;
      const amount = this.normalizeAmount(payload.amount);

      const signature = createHmac('sha256', this.webhookSecret)
        .update(`${payload.orderNo}|${tier.toLowerCase()}|${amount}`)
        .digest('hex');

      const body = {
        wmOrderId: payload.orderNo,
        tier: tier.toLowerCase(),
        amount: Number(amount),
        quantity: xcjItem.quantity,
        signature,
      };

      await this.postWithTimeout(body);
      this.logger.log(`小城笺 webhook 触发成功 orderNo=${payload.orderNo} tier=${tier} amount=${amount}`);
    } catch (err) {
      // 失败不阻塞订单,只记日志
      this.logger.warn(`小城笺 webhook 触发失败 orderNo=${payload.orderNo}: ${(err as Error).message}`);
    }
  }

  /**
   * 规范化金额: 去掉尾零,如 "18.00" -> "18", "0.10" -> "0.1"
   */
  private normalizeAmount(amount: string): string {
    const num = Number(amount);
    if (Number.isNaN(num)) {
      throw new Error(`无效的金额: ${amount}`);
    }
    return String(num);
  }

  /**
   * POST 请求,5 秒超时
   */
  private async postWithTimeout(body: unknown): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(this.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
