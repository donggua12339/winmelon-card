import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  NotifyResult,
} from '../payment-adapter.interface';

export interface MockConfig {
  /** 模拟支付的密钥（用于验签测试） */
  key: string;
}

/**
 * 模拟支付通道（仅用于本地开发与 E2E 测试）
 * - 创建支付返回 /payment/mock-pay?orderNo=xxx 页面，模拟用户点击"已支付"
 * - 回调验签：用 key 做 MD5，验证 out_trade_no + money + key
 *
 * 生产环境务必通过 PaymentChannel.isAvailable=false 关闭
 */
@Injectable()
export class MockAdapter implements PaymentAdapter {
  readonly code = 'mock';
  private readonly logger = new Logger(MockAdapter.name);

  async createPayment(
    params: CreatePaymentParams,
    _config: Record<string, unknown>,
  ): Promise<CreatePaymentResult> {
    const paymentUrl = `/payment/mock-pay?orderNo=${encodeURIComponent(params.orderNo)}&amount=${encodeURIComponent(params.amount)}`;
    return { paymentUrl };
  }

  parseNotify(
    rawBody: string,
    _headers: Record<string, string | undefined>,
    config: Record<string, unknown>,
  ): NotifyResult {
    const cfg = config as MockConfig;
    let params: Record<string, string>;
    try {
      params = Object.fromEntries(new URLSearchParams(rawBody));
    } catch {
      throw new Error('回调参数解析失败');
    }

    const expected = this.sign(params.out_trade_no, params.money, cfg.key);
    if (params.sign !== expected) {
      throw new Error('验签失败');
    }

    return {
      outTradeNo: params.out_trade_no,
      tradeNo: `MOCK_${params.out_trade_no}`,
      amount: params.money,
      success: true,
      raw: params,
    };
  }

  private sign(orderNo: string, money: string, key: string): string {
    return createHash('md5').update(`${orderNo}${money}${key}`, 'utf8').digest('hex');
  }
}
