import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SnowflakeService } from '../../infrastructure/id/snowflake.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { RefundService } from '../refund/refund.service';
import {
  TICKET_CREATED_EVENT,
  TICKET_REPLIED_EVENT,
  type TicketCreatedPayload,
  type TicketRepliedPayload,
} from './events/ticket.events';

const AUTO_REFUND_HOURS = 24; // 24h 自动退款
const MERCHANT_UNRESPONSED_FREEZE_THRESHOLD = 5; // 商户 5 次未响应自动冻结

export interface CreateTicketInput {
  orderNo: string;
  buyerEmail: string;
  category?: 'REFUND' | 'DELIVERY' | 'QUALITY' | 'OTHER';
  subject: string;
  description: string;
}

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly snowflake: SnowflakeService,
    private readonly mail: MailService,
    private readonly refundService: RefundService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ============== 买家侧 ==============

  /** 买家创建工单 */
  async create(input: CreateTicketInput, ctx: { ip: string; ua: string }) {
    if (!input.buyerEmail || !input.subject || !input.description) {
      throw new BadRequestException('邮箱、主题、描述不能为空');
    }
    if (!input.orderNo) {
      throw new BadRequestException('工单必须关联订单号');
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: input.orderNo },
      select: {
        id: true,
        shopId: true,
        buyerEmail: true,
        totalAmount: true,
        status: true,
        shop: {
          select: {
            id: true,
            name: true,
            merchantId: true,
            merchant: { select: { contactEmail: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.buyerEmail.toLowerCase() !== input.buyerEmail.toLowerCase()) {
      throw new ForbiddenException('邮箱与订单不匹配');
    }

    const orderId = order.id;
    const shopId = order.shopId;
    const merchantContactEmail = order.shop.merchant.contactEmail;

    const ticketNo = this.snowflake.next();
    const autoRefundAt = new Date(Date.now() + AUTO_REFUND_HOURS * 60 * 60 * 1000);

    const ticketData: Prisma.TicketUncheckedCreateInput = {
      ticketNo,
      orderId,
      shopId,
      buyerEmail: input.buyerEmail.toLowerCase(),
      buyerIp: ctx.ip,
      category: input.category || 'OTHER',
      subject: input.subject.slice(0, 255),
      description: input.description.slice(0, 65535),
      status: 'OPEN',
      autoRefundAt,
    };

    const ticket = await this.prisma.ticket.create({
      data: ticketData,
      include: { shop: { select: { name: true } } },
    });

    // 首条消息 = 工单描述
    await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderRole: 'buyer',
        content: input.description.slice(0, 65535),
      },
    });

    // 通知商户（异步）
    if (merchantContactEmail) {
      this.mail
        .send({
          to: merchantContactEmail,
          subject: `【WM 卡密平台】新工单 ${ticketNo} - ${input.subject}`,
          html: `<p>您收到一个新工单：</p><p><strong>${input.subject}</strong></p><p>${input.description.slice(0, 500)}</p><p>工单号：${ticketNo}</p><p>请在 24 小时内响应，否则系统将自动退款给买家。</p>`,
          text: `新工单 ${ticketNo} - ${input.subject}\n\n${input.description}\n\n请在 24 小时内响应。`,
        })
        .catch((err) => this.logger.error(`工单通知邮件失败: ${err.message}`));
    }

    await this.auditLog.record({
      action: 'ticket.create',
      resourceType: 'ticket',
      resourceId: ticket.id,
      afterData: { ticketNo, subject: input.subject, orderNo: input.orderNo },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    // 触发站内信 + 邮件通知商户（P2-3: 走事件，避免直接调用 trigger）
    this.eventEmitter.emit(TICKET_CREATED_EVENT, { ticketId: ticket.id } satisfies TicketCreatedPayload);

    return { ticketNo, id: ticket.id };
  }

  /** 买家查看工单（按 ticketNo + email 验证） */
  async findByBuyer(ticketNo: string, buyerEmail: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketNo },
      include: {
        messages: {
          where: { isInternal: false }, // 买家看不到平台内部备注
          orderBy: { createdAt: 'asc' },
        },
        shop: { select: { name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.buyerEmail.toLowerCase() !== buyerEmail.toLowerCase()) {
      throw new ForbiddenException('邮箱与工单不匹配');
    }
    return ticket;
  }

  /** 买家回复 */
  async replyFromBuyer(ticketNo: string, buyerEmail: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('回复内容不能为空');
    const ticket = await this.prisma.ticket.findUnique({ where: { ticketNo } });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (ticket.buyerEmail.toLowerCase() !== buyerEmail.toLowerCase()) {
      throw new ForbiddenException('邮箱与工单不匹配');
    }
    if (['RESOLVED', 'CLOSED', 'AUTO_REFUNDED'].includes(ticket.status)) {
      throw new BadRequestException('工单已关闭，无法回复');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: 'buyer',
          content: content.slice(0, 65535),
        },
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'BUYER_REPLIED',
          lastRepliedAt: new Date(),
          lastRepliedByRole: 'buyer',
        },
      });
    });

    // 通知商户：买家回复了
    this.eventEmitter.emit(TICKET_REPLIED_EVENT, {
      ticketId: ticket.id,
      senderRole: 'buyer',
    } satisfies TicketRepliedPayload);

    return { ok: true };
  }

  // ============== 商户侧 ==============

  async listForMerchant(merchantId: string, query: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.TicketWhereInput = {
      shop: { merchantId },
    };
    if (query.status) where.status = query.status as Prisma.TicketWhereInput['status'];
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { shop: { select: { name: true } }, order: { select: { orderNo: true } } },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOneForMerchant(merchantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, shop: { merchantId } },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        order: { select: { orderNo: true, totalAmount: true, status: true } },
      },
    });
    if (!ticket) throw new NotFoundException('工单不存在');
    return ticket;
  }

  async replyFromMerchant(
    merchantId: string,
    ticketId: string,
    content: string,
    ctx: { userId: string; username: string; ip?: string; ua?: string },
  ) {
    if (!content?.trim()) throw new BadRequestException('回复内容不能为空');
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, shop: { merchantId } },
    });
    if (!ticket) throw new NotFoundException('工单不存在');
    if (['RESOLVED', 'CLOSED', 'AUTO_REFUNDED'].includes(ticket.status)) {
      throw new BadRequestException('工单已关闭，无法回复');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: 'merchant',
          senderId: ctx.userId,
          senderName: ctx.username,
          content: content.slice(0, 65535),
        },
      });
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'MERCHANT_REPLIED',
          lastRepliedAt: new Date(),
          lastRepliedByRole: 'merchant',
        },
      });
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'ticket.merchant_reply',
      resourceType: 'ticket',
      resourceId: ticketId,
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    // 通知买家：商户回复了
    this.eventEmitter.emit(TICKET_REPLIED_EVENT, { ticketId, senderRole: 'merchant' } satisfies TicketRepliedPayload);

    return { ok: true };
  }

  async listForAdmin(query: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.TicketWhereInput = {};
    if (query.status) where.status = query.status as Prisma.TicketWhereInput['status'];
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          shop: { select: { name: true, merchant: { select: { name: true } } } },
          order: { select: { orderNo: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOneForAdmin(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        order: { select: { orderNo: true, totalAmount: true, status: true } },
        shop: { select: { name: true, merchant: { select: { name: true, contactEmail: true } } } },
      },
    });
    if (!ticket) throw new NotFoundException('工单不存在');
    return ticket;
  }

  async replyFromAdmin(
    ticketId: string,
    content: string,
    isInternal: boolean,
    ctx: { userId: string; username: string; ip?: string; ua?: string },
  ) {
    if (!content?.trim()) throw new BadRequestException('回复内容不能为空');
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('工单不存在');

    await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: 'platform',
          senderId: ctx.userId,
          senderName: ctx.username,
          content: content.slice(0, 65535),
          isInternal,
        },
      });
      // 内部备注不改状态
      if (!isInternal) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: 'PLATFORM_REPLIED',
            lastRepliedAt: new Date(),
            lastRepliedByRole: 'platform',
          },
        });
      }
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'ticket.admin_reply',
      resourceType: 'ticket',
      resourceId: ticketId,
      afterData: { isInternal },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    // 内部备注不发通知；非内部备注 → 通知买卖双方
    if (!isInternal) {
      this.eventEmitter.emit(TICKET_REPLIED_EVENT, {
        ticketId,
        senderRole: 'platform',
      } satisfies TicketRepliedPayload);
    }

    return { ok: true };
  }

  async resolve(ticketId: string, ctx: { userId: string; username: string; ip?: string; ua?: string }) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('工单不存在');
    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'ticket.resolve',
      resourceType: 'ticket',
      resourceId: ticketId,
      ip: ctx.ip,
      userAgent: ctx.ua,
    });
    return { ok: true };
  }

  // ============== 定时任务：24h 自动退款 ==============

  /**
   * 每 10 分钟扫描：
   * - status IN (OPEN, BUYER_REPLIED) 且 autoRefundAt < now
   * - 标记 AUTO_REFUNDED，退款金额回买家（MVP 简化：不实际退款，仅标记）
   * - 商户未响应次数 +1，达到阈值自动冻结
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoRefundExpiredTickets(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.ticket.findMany({
      where: {
        status: { in: ['OPEN', 'BUYER_REPLIED'] },
        autoRefundAt: { lt: now },
      },
      include: {
        order: { select: { id: true, orderNo: true, totalAmount: true, status: true } },
        shop: { select: { merchantId: true, merchant: { select: { id: true, name: true } } } },
      },
      take: 50,
    });

    if (expired.length === 0) return;
    this.logger.log(`扫描到 ${expired.length} 个超时工单，开始自动退款`);

    for (const ticket of expired) {
      try {
        await this.processAutoRefund(ticket);
      } catch (err) {
        this.logger.error(`工单 ${ticket.ticketNo} 自动退款失败: ${(err as Error).message}`);
      }
    }
  }

  private async processAutoRefund(
    ticket: Prisma.TicketGetPayload<{
      include: {
        order: { select: { id: true; orderNo: true; totalAmount: true; status: true } };
        shop: { select: { merchantId: true; merchant: { select: { id: true; name: true } } } };
      };
    }>,
  ): Promise<void> {
    const refundAmount = ticket.order ? Number(ticket.order.totalAmount) : 0;

    // 调用 RefundService.createAndPayDirect：创建 Refund + 订单 REFUNDED + 商户余额扣减 + 卡密重置 + 发事件
    // viewed_at 有值的订单会抛 ForbiddenException（Q13 约束），此时工单不自动退款，转人工
    if (ticket.order && ['PAID', 'DELIVERED'].includes(ticket.order.status) && refundAmount > 0) {
      try {
        await this.refundService.createAndPayDirect(ticket.order.id, {
          reason: `工单 ${ticket.ticketNo} 超时未响应，系统自动退款`,
          initiator: 'PLATFORM',
          manualPayout: true, // 阶段 1：线下打款标记
        });
      } catch (err) {
        // viewed_at 有值或余额超上限：工单仍标记 AUTO_REFUNDED 但不实际退款，转人工
        this.logger.warn(`工单 ${ticket.ticketNo} 自动退款跳过: ${(err as Error).message}，转人工处理`);
      }
    }

    // 工单状态更新 + 内部消息 + 商户冻结检查（保留原逻辑）
    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'AUTO_REFUNDED',
          resolvedAt: new Date(),
          refundAmount: refundAmount > 0 ? new Prisma.Decimal(refundAmount) : null,
        },
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: 'platform',
          senderName: '系统',
          content: `工单超时未响应，已自动退款 ¥${refundAmount.toFixed(2)} 给买家`,
          isInternal: false,
        },
      });

      // 商户未响应计数 + 检查冻结
      if (ticket.shop?.merchant?.id) {
        const unrespondedCount = await tx.ticket.count({
          where: {
            shop: { merchantId: ticket.shop.merchant.id },
            status: 'AUTO_REFUNDED',
          },
        });
        if (unrespondedCount >= MERCHANT_UNRESPONSED_FREEZE_THRESHOLD) {
          await tx.merchant.update({
            where: { id: ticket.shop.merchant.id },
            data: {
              frozenReason: `累计 ${unrespondedCount} 次工单未响应自动退款，系统自动冻结`,
              frozenAt: new Date(),
              status: 'SUSPENDED',
            },
          });
          this.logger.warn(`商户 ${ticket.shop.merchant.name} 因工单未响应被自动冻结`);
        }
      }
    });

    this.logger.log(`工单 ${ticket.ticketNo} 自动退款完成，金额 ¥${refundAmount.toFixed(2)}`);
  }
}
