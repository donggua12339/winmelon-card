/**
 * 商户申请相关领域事件
 */
export const MERCHANT_APPROVED_EVENT = 'merchant.approved';

export interface MerchantApprovedPayload {
  merchantEmail: string;
  merchantName: string;
  initialPassword: string;
  loginUrl: string;
}
