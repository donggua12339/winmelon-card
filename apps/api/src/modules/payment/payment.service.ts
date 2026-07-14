import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { AesGcmService } from '../../infrastructure/crypto/aes-gcm.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EpayAdapter } from './adapters/epay.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { UsdtAdapter } from './adapters/usdt.adapter';
import type { PaymentAdapter, NotifyResult } from './payment-adapter.interface';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';

const NOTIFY_IDEMPOTENCY_TTL_SEC = 24 * 60 * 60; // 回调幂等记录保留 24h

@Injectable()
export class PaymentService implements OnModuleInit {
  private readonly logger = new Logger(PaymentService.name);
  private readonly adapters: Map<string, PaymentAdapter>;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly aes: AesGcmService,
    private readonly auditLog: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
    private readonly epayAdapter: EpayAdapter,
    private readonly mockAdapter: MockAdapter,
    private readonly usdtAdapter: UsdtAdapter,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('PUBLIC_BASE_URL', 'http://localhost:3000');
    this.adapters = new Map<string, PaymentAdapter>([
      [epayAdapter.code, epayAdapter],
      [mockAdapter.code, mockAdapter],
      [usdtAdapter.code, usdtAdapter],
    ]);
  }

  /**
   * 启动时自动迁移：把旧的明文 PaymentChannel.config 加密
   * 幂等，已是加密格式则跳过
   */
  async onModuleInit(): Promise<void> {
    try {
      const channels = await this.prisma.paymentChannel.findMany({
        select: { code: true, config: true },
      });
      for (const ch of channels) {
        if (!ch.config) continue;
        try {
          const parsed = JSON.parse(ch.config);
          // 已是加密格式（含 ciphertext/iv/tag）
          if (parsed && typeof parsed === 'object' && parsed.ciphertext && parsed.iv && parsed.tag) {
            continue;
          }
          // 明文 JSON，加密后写回
          const encrypted = this.encryptConfig(parsed as Record<string, unknown>);
          await this.prisma.paymentChannel.update({
            where: { code: ch.code },
            data: { config: encrypted },
          });
          this.logger.log(`已加密支付通道配置: ${ch.code}`);
        } catch {
          this.logger.warn(`支付通道 ${ch.code} 配置解析失败，跳过迁移`);
        }
      }
    } catch (err) {
      this.logger.error(`支付通道配置迁移检查失败: ${(err as Error).message}`);
    }
  }

  /**
   * 创建支付订单
   * 1. 查订单（必须 PENDING 且未过期）
   * 2. 查通道配置
   * 3. 调 adapter.createPayment
   * 4. 写 Payment 记录（PENDING）
   */
  async createPayment(orderId: string, channelCode: string, ctx: { ip: string; requestId?: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNo: true,
        totalAmount: true,
        status: true,
        expireAt: true,
        items: { select: { productName: true } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'PENDING') throw new BadRequestException(`订单状态为 ${order.status}，无法支付`);
    if (order.expireAt < new Date()) throw new BadRequestException('订单已超时');

    const channel = await this.getAvailableChannel(channelCode);
    const adapter = this.getAdapter(channelCode);
    const config = this.decryptConfig(channel.config);

    const subject = order.items
      .map((it) => it.productName)
      .join(', ')
      .slice(0, 128);
    const result = await adapter.createPayment(
      {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: order.totalAmount.toString(),
        subject,
        notifyUrl: `${this.baseUrl}/api/payment/notify/${channelCode}`,
        returnUrl: `${this.baseUrl}/api/payment/return/${channelCode}?orderNo=${order.orderNo}`,
        clientIp: ctx.ip,
      },
      config,
    );

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        channel: channelCode,
        tradeNo: result.tradeNo,
        amount: order.totalAmount,
        status: 'PENDING',
        usdtWallet: result.metadata?.usdtWallet,
        usdtAmount: result.metadata?.usdtAmount,
        expiresAt: result.metadata?.expiresAt,
      },
    });

    return { paymentUrl: result.paymentUrl, orderNo: order.orderNo };
  }

  /**
   * 处理异步回调
   * 1. 加载通道 + 解密 config
   * 2. adapter.parseNotify 验签 + 解析
   * 3. Redis 幂等去重（tradeNo）
   * 4. 事务：订单 PAID + Payment SUCCESS + 发 OrderPaidEvent
   *
   * 返回给通道的响应字符串（如 "success"）
   */
  async handleNotify(
    channelCode: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<string> {
    const channel = await this.prisma.paymentChannel.findUnique({
      where: { code: channelCode },
    });
    if (!channel || !channel.isAvailable) {
      this.logger.warn(`通道 ${channelCode} 不存在或已禁用`);
      return 'fail';
    }

    const adapter = this.getAdapter(channelCode);
    const config = this.decryptConfig(channel.config);

    let notify: NotifyResult;
    try {
      notify = adapter.parseNotify(rawBody, headers, config);
    } catch (err) {
      this.logger.error(`回调验签失败 channel=${channelCode}: ${(err as Error).message}`);
      await this.auditLog.record({
        action: 'payment.notify.verify_failed',
        resourceType: 'payment_channel',
        resourceId: channelCode,
        afterData: { raw: rawBody.slice(0, 500) },
      });
      return 'fail';
    }

    if (!notify.success) {
      this.logger.log(`回调非成功状态 channel=${channelCode} outTradeNo=${notify.outTradeNo}`);
      return 'success'; // 业务失败也回复 success 避免通道重试
    }

    // 幂等：同一 tradeNo 24h 内只处理一次
    const idempotencyKey = `payment:notify:${notify.tradeNo}`;
    const set = await this.redis.set(idempotencyKey, '1', 'EX', NOTIFY_IDEMPOTENCY_TTL_SEC, 'NX');
    if (!set) {
      this.logger.log(`回调重复 tradeNo=${notify.tradeNo}，跳过`);
      return 'success';
    }

    // 事务：订单状态流转 + Payment SUCCESS + 发事件
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { orderNo: notify.outTradeNo },
          select: { id: true, status: true, totalAmount: true },
        });
        if (!order) {
          throw new NotFoundException(`订单不存在 outTradeNo=${notify.outTradeNo}`);
        }

        // 已支付/已发卡，直接幂等返回
        if (order.status === 'PAID' || order.status === 'DELIVERED') {
          return { alreadyPaid: true };
        }
        if (order.status !== 'PENDING') {
          throw new BadRequestException(`订单状态异常 orderNo=${notify.outTradeNo} status=${order.status}`);
        }

        // 金额校验（防伪造，用数值比较避免 "10.00" vs "10" 字符串误判）
        if (Number(order.totalAmount) !== Number(notify.amount)) {
          throw new BadRequestException(`金额不匹配 order=${order.totalAmount} notify=${notify.amount}`);
        }

        // 更新订单
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAID', paidAt: new Date() },
        });

        // 更新 Payment
        const payment = await tx.payment.updateMany({
          where: { orderId: order.id, channel: channelCode, status: 'PENDING' },
          data: {
            status: 'SUCCESS',
            tradeNo: notify.tradeNo,
            paidAt: new Date(),
            rawNotify: JSON.stringify(notify.raw).slice(0, 65535),
          },
        });
        if (payment.count === 0) {
          // 没有对应的 PENDING Payment，新建一条
          await tx.payment.create({
            data: {
              orderId: order.id,
              channel: channelCode,
              tradeNo: notify.tradeNo,
              amount: order.totalAmount,
              status: 'SUCCESS',
              paidAt: new Date(),
              rawNotify: JSON.stringify(notify.raw).slice(0, 65535),
            },
          });
        }

        return { alreadyPaid: false, orderId: order.id, orderNo: notify.outTradeNo };
      });

      if (result.alreadyPaid) {
        return 'success';
      }

      // 发事件触发发卡（事务外，避免长事务）
      const payload: OrderPaidPayload = {
        orderId: result.orderId!,
        orderNo: result.orderNo!,
        paymentId: '',
        channel: channelCode,
        amount: notify.amount,
        paidAt: new Date(),
      };
      this.eventEmitter.emit(ORDER_PAID_EVENT, payload);

      await this.auditLog.record({
        action: 'payment.notify.success',
        resourceType: 'order',
        resourceId: result.orderId!,
        afterData: { channel: channelCode, tradeNo: notify.tradeNo, amount: notify.amount },
      });

      return 'success';
    } catch (err) {
      // 业务失败：回滚幂等标记，允许通道重试
      await this.redis.del(idempotencyKey);
      this.logger.error(`回调处理失败: ${(err as Error).message}`);
      return 'fail';
    }
  }

  /**
   * 同步跳转 return_url
   * 仅用于展示，不做状态流转（状态以异步回调为准）
   */
  async handleReturn(channelCode: string, query: Record<string, string>): Promise<{ orderNo: string }> {
    const channel = await this.prisma.paymentChannel.findUnique({
      where: { code: channelCode },
    });
    if (!channel) throw new NotFoundException('通道不存在');

    const adapter = this.getAdapter(channelCode);
    const config = this.decryptConfig(channel.config);

    if (!adapter.parseReturn) {
      // 默认从 query 取 orderNo
      return { orderNo: query.orderNo ?? '' };
    }
    const result = adapter.parseReturn(query, config);
    return { orderNo: result.outTradeNo };
  }

  /**
   * 模拟支付：买家在 /payment/mock-pay 点击"已支付"后，触发回调
   * 仅 mock 通道可用
   */
  async triggerMockPay(orderNo: string): Promise<void> {
    const channel = await this.prisma.paymentChannel.findUnique({ where: { code: 'mock' } });
    if (!channel || !channel.isAvailable) {
      throw new BadRequestException('模拟支付通道未启用');
    }
    const order = await this.prisma.order.findFirst({
      where: { orderNo },
      select: { id: true, orderNo: true, totalAmount: true, status: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'PENDING') throw new BadRequestException('订单非待支付状态');

    const cfg = this.decryptConfig(channel.config) as { key: string };
    const { createHash } = await import('crypto');
    const sign = createHash('md5')
      .update(`${order.orderNo}${order.totalAmount.toString()}${cfg.key}`, 'utf8')
      .digest('hex');
    const body = new URLSearchParams({
      out_trade_no: order.orderNo,
      money: order.totalAmount.toString(),
      sign,
    }).toString();

    // 异步触发回调（不阻塞响应）
    setImmediate(() => {
      this.handleNotify('mock', body, {}).catch((err) => this.logger.error(`模拟回调失败: ${(err as Error).message}`));
    });
  }

  // ====== 后台：通道管理 ======

  async listChannels() {
    const channels = await this.prisma.paymentChannel.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, name: true, isAvailable: true, updatedAt: true },
    });
    return channels;
  }

  async getChannelConfig(code: string) {
    const channel = await this.prisma.paymentChannel.findUnique({ where: { code } });
    if (!channel) throw new NotFoundException('通道不存在');
    // 返回解密后的配置（仅供后台编辑用，需 SUPER_ADMIN 权限）
    return {
      code: channel.code,
      name: channel.name,
      isAvailable: channel.isAvailable,
      config: this.decryptConfig(channel.config),
    };
  }

  async updateChannel(code: string, data: { name?: string; isAvailable?: boolean; config?: Record<string, unknown> }) {
    const channel = await this.prisma.paymentChannel.findUnique({ where: { code } });
    if (!channel) throw new NotFoundException('通道不存在');

    const update: { name?: string; isAvailable?: boolean; config?: string } = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.isAvailable !== undefined) update.isAvailable = data.isAvailable;
    if (data.config !== undefined) update.config = this.encryptConfig(data.config);

    return this.prisma.paymentChannel.update({
      where: { code },
      data: update,
      select: { code: true, name: true, isAvailable: true, updatedAt: true },
    });
  }

  // ====== 私有方法 ======

  private async getAvailableChannel(code: string) {
    const channel = await this.prisma.paymentChannel.findUnique({ where: { code } });
    if (!channel || !channel.isAvailable) {
      throw new BadRequestException(`支付通道 ${code} 不可用`);
    }
    return channel;
  }

  private getAdapter(code: string): PaymentAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new BadRequestException(`不支持的支付通道: ${code}`);
    }
    return adapter;
  }

  /**
   * 解密通道配置
   * - 新格式：JSON 字符串 {ciphertext, iv, tag}，用 AesGcmService 解密
   * - 兼容旧格式：明文 JSON 字符串（迁移期间）
   * 失败返回 {}，调用方应处理空配置
   */
  private decryptConfig(encrypted: string): Record<string, unknown> {
    if (!encrypted) return {};
    try {
      const parsed = JSON.parse(encrypted);
      if (parsed && typeof parsed === 'object' && parsed.ciphertext && parsed.iv && parsed.tag) {
        // 新格式：AES-256-GCM 加密
        const json = this.aes.decrypt({
          ciphertext: parsed.ciphertext,
          iv: parsed.iv,
          tag: parsed.tag,
        });
        return JSON.parse(json);
      }
      // 旧格式：明文 JSON（兼容迁移期）
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private encryptConfig(config: Record<string, unknown>): string {
    const json = JSON.stringify(config);
    const payload = this.aes.encrypt(json);
    return JSON.stringify(payload);
  }
}
