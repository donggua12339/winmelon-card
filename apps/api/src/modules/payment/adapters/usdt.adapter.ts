import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  NotifyResult,
  RefundParams,
  RefundResult,
} from '../payment-adapter.interface';

export interface UsdtConfig {
  /** TRC20 收款钱包地址 */
  walletAddress: string;
  /** 确认数（建议 >= 19） */
  confirmations?: number;
  /** 汇率：1 CNY = ? USDT（留空则用 0.14 兜底） */
  cnyToUsdt?: string;
}

/**
 * USDT TRC20 加密货币支付通道
 *
 * 流程：
 * 1. createPayment 生成唯一金额（价格 USDT + 0.01-0.99 随机后缀），写入 Payment.usdtAmount
 * 2. 前端展示钱包地址 + 金额 + 二维码 + 倒计时
 * 3. UsdtService 定时轮询 TronGrid，按金额匹配 PENDING 支付
 * 4. 匹配到链上交易后，标记 Payment SUCCESS + 触发 OrderPaidEvent
 *
 * 不使用传统回调，parseNotify 始终抛错
 */
@Injectable()
export class UsdtAdapter implements PaymentAdapter {
  readonly code = 'usdt';
  private readonly logger = new Logger(UsdtAdapter.name);

  async createPayment(params: CreatePaymentParams, config: Record<string, unknown>): Promise<CreatePaymentResult> {
    const cfg = config as unknown as UsdtConfig;
    if (!cfg.walletAddress) {
      throw new Error('USDT 通道未配置 walletAddress');
    }

    // 生成唯一后缀金额（0.01-0.99 USDT），用于链上匹配
    const suffix = Math.floor(Math.random() * 99) + 1;
    const rate = cfg.cnyToUsdt ? Number(cfg.cnyToUsdt) : 0.14;
    const baseUsdt = Number(params.amount) * rate;
    const usdtAmount = Math.round((baseUsdt + suffix / 100) * 1e6) / 1e6;

    // 金额写入 tradeNo 便于 payment.service 记录（实际写入由 UsdtService 二次更新）
    const paymentUrl = `/payment/usdt?orderNo=${encodeURIComponent(params.orderNo)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 分钟超时
    return {
      paymentUrl,
      tradeNo: `USDT_${params.orderNo}`,
      metadata: {
        usdtWallet: cfg.walletAddress,
        usdtAmount: usdtAmount.toFixed(6),
        expiresAt,
      },
    };
  }

  parseNotify(): NotifyResult {
    throw new Error('USDT 通道不使用异步回调，请通过轮询确认');
  }

  /**
   * USDT 通道退款：链上交易无法由通道 API 触发原路退回
   * 强制走 manualPayout 流程（admin 手动从商户钱包转给买家）
   */
  async refund(_params: RefundParams, _config: Record<string, unknown>): Promise<RefundResult> {
    throw new Error('USDT 通道不支持自动退款，请使用 manualPayout=true 由 admin 手动打款');
  }
}
