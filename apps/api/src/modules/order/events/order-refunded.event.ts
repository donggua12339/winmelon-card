/**
 * 订单退款事件
 * Refund PAID 时触发，invite.service 监听并冲正返佣
 */
export const ORDER_REFUNDED_EVENT = 'order.refunded';

export interface OrderRefundedPayload {
  refundId: string;
  refundNo: string;
  orderId: string;
  orderNo: string;
  merchantId: string;
  amount: string;
  paidAt: Date;
}
