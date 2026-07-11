import { Injectable, Logger } from '@nestjs/common';
import { createHmac, createHash } from 'crypto';
import type {
  PaymentAdapter,
  CreatePaymentParams,
  CreatePaymentResult,
  NotifyResult,
} from '../payment-adapter.interface';

export interface EpayConfig {
  pid: string;
  key: string;
  apiDomain: string; // 如 https://pay.example.com
}

/**
 * 彩虹易支付适配器
 * - 签名规则：参数字典序 + 过滤 sign/sign_type/空值 + 末尾追加 key + MD5 小写
 * - 异步回调响应："success"
 * - 安全要点：
 *   1. 金额必须从 DB 读取，不可信任回调参数
 *   2. 验签失败立即拒绝
 *   3. trade_status 必须为 TRADE_SUCCESS
 */
@Injectable()
export class EpayAdapter implements PaymentAdapter {
  readonly code = 'epay';
  private readonly logger = new Logger(EpayAdapter.name);

  async createPayment(params: CreatePaymentParams, config: Record<string, unknown>): Promise<CreatePaymentResult> {
    const cfg = config as unknown as EpayConfig;
    const args: Record<string, string> = {
      pid: cfg.pid,
      type: 'alipay', // MVP 固定支付宝，后续可参数化
      out_trade_no: params.orderNo,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      name: params.subject,
      money: params.amount,
      clientip: params.clientIp,
      sign_type: 'MD5',
    };
    args.sign = this.sign(args, cfg.key);

    const query = new URLSearchParams(args).toString();
    const paymentUrl = `${cfg.apiDomain}/submit.php?${query}`;
    return { paymentUrl };
  }

  parseNotify(
    rawBody: string,
    _headers: Record<string, string | undefined>,
    config: Record<string, unknown>,
  ): NotifyResult {
    const cfg = config as unknown as EpayConfig;
    let params: Record<string, string>;
    try {
      params = Object.fromEntries(new URLSearchParams(rawBody));
    } catch {
      throw new Error('回调参数解析失败');
    }

    // 验签
    const expectedSign = this.sign(params, cfg.key);
    if (params.sign !== expectedSign) {
      this.logger.warn(`易支付验签失败 out_trade_no=${params.out_trade_no}`);
      throw new Error('验签失败');
    }

    const success = params.trade_status === 'TRADE_SUCCESS';
    return {
      outTradeNo: params.out_trade_no ?? '',
      tradeNo: params.trade_no ?? '',
      amount: params.money ?? '',
      success,
      raw: {
        pid: params.pid,
        trade_no: params.trade_no,
        out_trade_no: params.out_trade_no,
        type: params.type,
        name: params.name,
        money: params.money,
        trade_status: params.trade_status,
      },
    };
  }

  /**
   * 易支付签名算法：
   * 1. 过滤 sign / sign_type / 值为空的参数
   * 2. 按 key 字典序排序
   * 3. 拼成 a=1&b=2&c=3
   * 4. 末尾追加 key（不加 &）
   * 5. MD5 取小写 hex
   */
  private sign(params: Record<string, string>, key: string): string {
    const filtered = Object.entries(params)
      .filter(([k, v]) => k !== 'sign' && k !== 'sign_type' && v !== '' && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const str = filtered.map(([k, v]) => `${k}=${v}`).join('&') + key;
    return createHash('md5').update(str, 'utf8').digest('hex');
  }
}

// 避免 createHmac 未使用告警（保留以备 sign_type=HMAC 后续扩展）
void createHmac;
