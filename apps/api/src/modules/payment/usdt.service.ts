import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TRONGRID_BASE = 'https://api.trongrid.io/v1';

interface TronTrc20Transfer {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  block_timestamp: number;
  confirmed: boolean;
}

@Injectable()
export class UsdtService {
  private readonly logger = new Logger(UsdtService.name);
  private readonly processedTxKey = 'usdt:processed-tx';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 每 30 秒轮询一次：获取所有 USDT 通道 PENDING 支付对应钱包的最近交易
   */
  @Cron('*/30 * * * * *')
  async pollPendingPayments(): Promise<void> {
    let pendingPayments;
    try {
      pendingPayments = await this.prisma.payment.findMany({
        where: {
          channel: 'usdt',
          status: 'PENDING',
          usdtWallet: { not: null },
          usdtAmount: { not: null },
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          orderId: true,
          usdtWallet: true,
          usdtAmount: true,
          expiresAt: true,
        },
        take: 50,
      });
    } catch (err) {
      this.logger.error(`查询 PENDING 支付失败：${(err as Error).message}`);
      return;
    }

    if (pendingPayments.length === 0) return;

    // 按钱包地址分组
    const byWallet = new Map<string, typeof pendingPayments>();
    for (const p of pendingPayments) {
      const wallet = p.usdtWallet!;
      if (!byWallet.has(wallet)) byWallet.set(wallet, []);
      byWallet.get(wallet)!.push(p);
    }

    for (const [wallet, payments] of byWallet) {
      try {
        const transfers = await this.fetchRecentTransfers(wallet);
        for (const tx of transfers) {
          // Redis 幂等：已处理的 tx 跳过
          const seen = await this.redis.get(`${this.processedTxKey}:${tx.transaction_id}`);
          if (seen) continue;

          // 匹配金额（USDT 6 位精度，value 是最小单位）
          const txAmount = Number(tx.value) / 1e6;
          const matched = payments.find((p) => Math.abs(Number(p.usdtAmount) - txAmount) < 1e-6);
          if (matched) {
            await this.confirmPayment(matched, tx.transaction_id);
          }

          // 标记已处理（24h）
          await this.redis.set(`${this.processedTxKey}:${tx.transaction_id}`, '1', 'EX', 24 * 60 * 60);
        }
      } catch (err) {
        this.logger.error(`轮询钱包 ${wallet} 失败：${(err as Error).message}`);
      }
    }
  }

  /** 调用 TronGrid API 获取钱包的最近 TRC20 转入 */
  private async fetchRecentTransfers(walletAddress: string): Promise<TronTrc20Transfer[]> {
    const url = `${TRONGRID_BASE}/accounts/${walletAddress}/transactions/trc20?limit=50&only_to=true&contract_address=${USDT_CONTRACT}&order_by=block_timestamp,desc`;
    const resp = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      throw new Error(`TronGrid 返回 ${resp.status}`);
    }
    const json = (await resp.json()) as { data?: TronTrc20Transfer[] };
    return json.data ?? [];
  }

  /** 确认支付：事务更新 Payment + Order，发送 OrderPaidEvent */
  private async confirmPayment(payment: { id: string; orderId: string }, txHash: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            paidAt: new Date(),
            usdtTxHash: txHash,
          },
          select: { status: true, amount: true },
        });
        if (updated.status !== 'SUCCESS') return;

        const order = await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paidAt: new Date() },
          select: { id: true, orderNo: true, shopId: true },
        });

        this.eventEmitter.emit(ORDER_PAID_EVENT, {
          orderId: order.id,
          orderNo: order.orderNo,
          paymentId: payment.id,
          channel: 'usdt',
          amount: updated.amount.toString(),
          paidAt: new Date(),
        } satisfies OrderPaidPayload);
      });
      this.logger.log(`USDT 支付确认成功：payment=${payment.id} tx=${txHash}`);
    } catch (err) {
      this.logger.error(`确认支付失败 payment=${payment.id}：${(err as Error).message}`);
    }
  }

  /** 前端查询 USDT 支付信息 */
  async getPaymentInfo(orderNo: string): Promise<{
    orderNo: string;
    walletAddress: string;
    usdtAmount: string;
    expiresAt: string;
    status: string;
    network: string;
  }> {
    const payment = await this.prisma.payment.findFirst({
      where: { order: { orderNo }, channel: 'usdt' },
      select: {
        status: true,
        usdtWallet: true,
        usdtAmount: true,
        expiresAt: true,
        usdtTxHash: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment || !payment.usdtWallet) {
      throw new NotFoundException('未找到 USDT 支付记录');
    }
    return {
      orderNo,
      walletAddress: payment.usdtWallet,
      usdtAmount: Number(payment.usdtAmount).toFixed(6),
      expiresAt: payment.expiresAt!.toISOString(),
      status: payment.status,
      network: 'TRC20',
    };
  }

  /** 标记超时未支付的 USDT 支付为 EXPIRED */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStalePayments(): Promise<void> {
    const result = await this.prisma.payment.updateMany({
      where: {
        channel: 'usdt',
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`标记 ${result.count} 笔 USDT 支付为 EXPIRED`);
    }
  }
}
