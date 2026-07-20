/**
 * 提现相关领域事件
 * 通过 NestJS EventEmitter 解耦模块
 */
export const WITHDRAWAL_CREATED_EVENT = 'withdrawal.created';
export const WITHDRAWAL_STATUS_CHANGED_EVENT = 'withdrawal.status_changed';

export interface WithdrawalCreatedPayload {
  withdrawalId: string;
}

export interface WithdrawalStatusChangedPayload {
  withdrawalId: string;
  status: 'APPROVING' | 'PAID' | 'REJECTED';
  reason?: string;
}
