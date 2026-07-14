import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationService } from './notification.service';
import { ORDER_PAID_EVENT, type OrderPaidPayload } from '../order/events/order-paid.event';

/**
 * 通知事件触发器
 * 集中监听业务事件，自动发站内信
 * 避免在每个业务模块都注入 NotificationService
 */
@Injectable()
export class NotificationTriggerService {
  private readonly logger = new Logger(NotificationTriggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * 订单支付成功 → 通知商户
   * （邮件发送在 DeliveryService 的 sendDeliveryEmail 中处理）
   */
  @OnEvent(ORDER_PAID_EVENT)
  async handleOrderPaid(payload: OrderPaidPayload): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: payload.orderId },
        select: {
          orderNo: true,
          totalAmount: true,
          shop: {
            select: {
              merchantId: true,
              merchant: { select: { id: true, name: true, contactEmail: true } },
            },
          },
        },
      });
      if (!order?.shop?.merchant) return;

      await this.notification.notifyMerchant({
        merchantId: order.shop.merchantId,
        type: 'ORDER',
        title: `订单已支付 ¥${order.totalAmount}`,
        content: `订单 ${order.orderNo} 买家已完成支付，发卡已自动处理。`,
        link: `/merchant/orders`,
        sendEmail: false, // 邮件已在 DeliveryService 处理
      });
    } catch (err) {
      this.logger.error(`订单支付通知失败: ${(err as Error).message}`);
    }
  }

  /**
   * 工单创建成功 → 通知商户
   * 替代 ticket.service.ts 中直接的 mail.send 调用
   */
  async notifyTicketCreated(ticketId: string): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          shop: {
            select: {
              merchantId: true,
              merchant: { select: { name: true, contactEmail: true } },
            },
          },
        },
      });
      if (!ticket?.shop?.merchant) return;

      await this.notification.notifyMerchant({
        merchantId: ticket.shop.merchantId,
        type: 'TICKET',
        title: `新工单 ${ticket.ticketNo} - ${ticket.subject}`,
        content: `买家 ${ticket.buyerEmail} 提交了工单：${ticket.subject}\n\n${ticket.description.slice(0, 200)}\n\n请在 24 小时内响应。`,
        link: `/merchant/tickets`,
        sendEmail: true,
        emailTo: ticket.shop.merchant.contactEmail,
      });
    } catch (err) {
      this.logger.error(`工单通知失败: ${(err as Error).message}`);
    }
  }

  /**
   * 工单回复 → 通知对应方
   * @param senderRole 'buyer' | 'merchant' | 'platform' 发送方
   * 内部查询 ticket 决定通知对象
   */
  async notifyTicketReply(ticketId: string, senderRole: 'buyer' | 'merchant' | 'platform'): Promise<void> {
    try {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: {
          ticketNo: true,
          subject: true,
          shop: { select: { merchantId: true } },
        },
      });
      if (!ticket) return;

      // 买家/平台回复 → 通知商户
      if (senderRole !== 'merchant' && ticket.shop?.merchantId) {
        await this.notification.notifyMerchant({
          merchantId: ticket.shop.merchantId,
          type: 'TICKET',
          title: `工单 ${ticket.ticketNo} 有新回复`,
          content: `工单「${ticket.subject}」收到 ${senderRole === 'platform' ? '平台' : '买家'}回复，请及时处理。`,
          link: `/merchant/tickets`,
        });
      }
    } catch (err) {
      this.logger.error(`工单回复通知失败: ${(err as Error).message}`);
    }
  }

  /**
   * 提现申请 → 通知平台
   */
  async notifyWithdrawalPending(withdrawalId: string): Promise<void> {
    try {
      const w = await this.prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: {
          merchant: { select: { name: true } },
        },
      });
      if (!w) return;

      await this.notification.notifyAdmin({
        type: 'WITHDRAWAL',
        title: `新提现申请 ¥${w.amount}`,
        content: `商户「${w.merchant.name}」申请提现 ¥${w.amount}（实付 ¥${w.actual}），请审核。`,
        link: `/admin/withdrawals`,
      });
    } catch (err) {
      this.logger.error(`提现申请通知失败: ${(err as Error).message}`);
    }
  }

  /**
   * 提现审核结果 → 通知商户
   */
  async notifyWithdrawalResult(
    withdrawalId: string,
    result: 'APPROVING' | 'PAID' | 'REJECTED',
    reason?: string,
  ): Promise<void> {
    try {
      const w = await this.prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        include: {
          merchant: { select: { name: true, contactEmail: true } },
        },
      });
      if (!w?.merchant) return;

      const titleMap = {
        APPROVING: `提现申请已通过 ¥${w.amount}`,
        PAID: `提现已打款 ¥${w.actual}`,
        REJECTED: `提现申请被拒绝`,
      } as const;
      const contentMap = {
        APPROVING: `您的提现 ¥${w.amount} 申请已通过审核，平台将尽快打款。`,
        PAID: `您的提现 ¥${w.actual} 已完成打款，请查收。`,
        REJECTED: `您的提现 ¥${w.amount} 申请被拒绝。原因：${reason ?? '无'}`,
      } as const;

      await this.notification.notifyMerchant({
        merchantId: w.merchantId,
        type: 'WITHDRAWAL',
        title: titleMap[result],
        content: contentMap[result],
        link: `/merchant/withdrawals`,
        sendEmail: true,
        emailTo: w.merchant.contactEmail,
      });
    } catch (err) {
      this.logger.error(`提现结果通知失败: ${(err as Error).message}`);
    }
  }

  /**
   * 商户审核通过 → 通知申请人
   */
  async notifyMerchantApproved(
    merchantEmail: string,
    merchantName: string,
    initialPassword: string,
    _loginUrl: string,
  ): Promise<void> {
    await this.notification.notifyMerchant({
      merchantId: '', // 商户刚创建还没 ID，用 email 通知
      type: 'SYSTEM',
      title: `🎉 商户入驻成功 - ${merchantName}`,
      content: `您的商户账号已开通，初始密码：${initialPassword}，请尽快登录修改。`,
      link: '/',
      sendEmail: true,
      emailTo: merchantEmail,
    });
  }

  /**
   * 返佣结算 → 通知邀请人
   */
  async notifyCommissionEarned(inviterMerchantId: string, amount: number, sourceMerchantName: string): Promise<void> {
    try {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: inviterMerchantId },
        select: { contactEmail: true, name: true },
      });
      if (!merchant) return;

      await this.notification.notifyMerchant({
        merchantId: inviterMerchantId,
        type: 'COMMISSION',
        title: `收到返佣 ¥${amount.toFixed(2)}`,
        content: `「${sourceMerchantName}」的订单产生了 ¥${amount.toFixed(2)} 返佣，已自动结算到您的余额。`,
        link: `/merchant/invite`,
        sendEmail: false,
      });
    } catch (err) {
      this.logger.error(`返佣通知失败: ${(err as Error).message}`);
    }
  }
}
