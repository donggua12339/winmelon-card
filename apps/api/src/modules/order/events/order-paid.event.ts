/**
 * 订单相关领域事件
 * 通过 NestJS EventEmitter 解耦模块
 */
export const ORDER_PAID_EVENT = 'order.paid';

export interface OrderPaidPayload {
  orderId: string;
  orderNo: string;
  paymentId: string;
  channel: string;
  amount: string;
  paidAt: Date;
}
