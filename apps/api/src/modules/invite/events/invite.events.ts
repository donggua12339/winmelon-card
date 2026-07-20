/**
 * 邀请返佣相关领域事件
 */
export const COMMISSION_EARNED_EVENT = 'commission.earned';

export interface CommissionEarnedPayload {
  inviterMerchantId: string;
  amount: number;
  sourceMerchantName: string;
}
