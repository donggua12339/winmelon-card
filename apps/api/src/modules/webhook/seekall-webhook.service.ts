import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';

/**
 * SeekAll Webhook 触发器
 *
 * 监听订单支付成功事件,若订单包含 SeekAll 会员卡商品(trial/monthly/lifetime),
 * 主动 POST 到 SeekAll 后端,SeekAll 验证签名后生成 License code 入库。
 *
 * 约定:
 * - 失败不阻塞订单(只记日志),SeekAll 端有幂等,补单可手动
 * - HTTP 超时 5 秒
 * - 签名: HMAC-SHA256(secret, "${wmOrderId}|${tier}|${amount}"),amount 为字符串(如 "18" 而非 "18.00")
 */
@Injectable()
export class SeekallWebhookService {
  private readonly logger = new Logger(SeekallWebhookService.name);
  private readonly webhookUrl: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.webhookUrl = this.config.get<string>('SEEKALL_WEBHOOK_URL');
    this.webhookSecret = this.config.get<string>('WM_WEBHOOK_SECRET');
  }

  @OnEvent(ORDER_PAID_EVENT)
  async handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
    try {
      if (!this.webhookUrl || !this.webhookSecret) {
        this.logger.debug('SeekAll webhook 未配置(SEEKALL_WEBHOOK_URL/WM_WEBHOOK_SECRET),跳过');
        return;
      }

      // 查订单的 OrderItem -> Product,找第一个 seekallTier 非空的商品
      const items = await this.prisma.orderItem.findMany({
        where: { orderId: payload.orderId },
        select: {
          quantity: true,
          product: { select: { seekallTier: true, name: true } },
        },
      });

      const seekallItem = items.find((it) => it.product.seekallTier !== null);
      if (!seekallItem) {
        // 非 SeekAll 商品,不触发
        return;
      }

      const tier = seekallItem.product.seekallTier!;
      const amount = this.normalizeAmount(payload.amount);

      const signature = createHmac('sha256', this.webhookSecret)
        .update(`${payload.orderNo}|${tier.toLowerCase()}|${amount}`)
        .digest('hex');

      const body = {
        wmOrderId: payload.orderNo,
        tier: tier.toLowerCase(),
        amount: Number(amount),
        signature,
      };

      await this.postWithTimeout(body);
      this.logger.log(`SeekAll webhook 触发成功 orderNo=${payload.orderNo} tier=${tier} amount=${amount}`);
    } catch (err) {
      // 失败不阻塞订单,只记日志
      this.logger.warn(`SeekAll webhook 触发失败 orderNo=${payload.orderNo}: ${(err as Error).message}`);
    }
  }

  /**
   * 规范化金额: 去掉尾零,如 "18.00" -> "18", "0.10" -> "0.1"
   * 签名时 amount 必须是字符串形式(规格文档约定)
   */
  private normalizeAmount(amount: string): string {
    const num = Number(amount);
    if (Number.isNaN(num)) {
      throw new Error(`无效的金额: ${amount}`);
    }
    // Number -> String 自动去掉无意义的零,如 18 -> "18", 0.1 -> "0.1"
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
