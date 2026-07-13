/**
 * 支付通道适配器接口
 * 每个支付通道（易支付、微信、支付宝、USDT）实现此接口
 *
 * config 由 PaymentService 从 PaymentChannel 表加载并解密后传入，
 * 适配器本身不持有配置，便于多租户/多实例场景
 */
export interface PaymentAdapter {
  /** 通道代码，对应 PaymentChannel.code */
  readonly code: string;

  /**
   * 创建支付订单，返回跳转 URL 或二维码
   */
  createPayment(params: CreatePaymentParams, config: Record<string, unknown>): Promise<CreatePaymentResult>;

  /**
   * 解析异步回调，必须内部验签
   * 验签失败抛 Error
   */
  parseNotify(
    rawBody: string,
    headers: Record<string, string | undefined>,
    config: Record<string, unknown>,
  ): NotifyResult;

  /** 同步跳转（return_url）参数解析，可选实现 */
  parseReturn?(query: Record<string, string>, config: Record<string, unknown>): NotifyResult;
}

export interface CreatePaymentParams {
  orderId: string;
  orderNo: string;
  amount: string; // 金额（元），2 位小数
  subject: string; // 商品名
  notifyUrl: string;
  returnUrl: string;
  clientIp: string;
}

export interface CreatePaymentResult {
  paymentUrl: string;
  tradeNo?: string;
  /** 通道特定元数据（如 USDT 的钱包地址、金额、过期时间） */
  metadata?: {
    usdtWallet?: string;
    usdtAmount?: string;
    expiresAt?: Date;
  };
}

export interface NotifyResult {
  outTradeNo: string; // 商户订单号（我方 orderNo）
  tradeNo: string; // 通道流水号
  amount: string;
  success: boolean;
  raw: unknown;
}
