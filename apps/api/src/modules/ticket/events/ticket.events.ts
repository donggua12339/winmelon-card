/**
 * 工单相关领域事件
 * 通过 NestJS EventEmitter 解耦模块
 */
export const TICKET_CREATED_EVENT = 'ticket.created';
export const TICKET_REPLIED_EVENT = 'ticket.replied';

export interface TicketCreatedPayload {
  ticketId: string;
}

export interface TicketRepliedPayload {
  ticketId: string;
  senderRole: 'buyer' | 'merchant' | 'platform';
}
