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

  /**
   * 通道原路退款（阶段 2 实际退钱）
   * - 不支持自动退款的通道（如 USDT 链上）抛 BusinessError，调用方需走 manualPayout
   * - 退款成功后返回通道退款流水号（tradeNo）
   */
  refund(params: RefundParams, config: Record<string, unknown>): Promise<RefundResult>;
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

/** 退款入参 */
export interface RefundParams {
  /** 我方退款单号（雪花 ID） */
  refundNo: string;
  /** 原订单号 */
  orderNo: string;
  /** 原通道流水号（部分通道必填） */
  originalTradeNo?: string;
  /** 退款金额（元，2 位小数） */
  amount: string;
  /** 原订单总金额（元，2 位小数；微信退款需上送 total，缺省则按全额退处理） */
  originalAmount?: string;
  /** 退款原因（透传给通道） */
  reason?: string;
}

/** 退款结果 */
export interface RefundResult {
  /** 通道退款流水号 */
  tradeNo: string;
  /** 通道返回的原始数据（便于排查） */
  raw: unknown;
  /** 退款是否同步成功（部分通道异步回调才知结果） */
  success: boolean;
}
