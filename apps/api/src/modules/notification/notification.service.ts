import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailService } from '../../infrastructure/mail/mail.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * 给商户发通知（+可选邮件代发）
   * 业务模块调用此方法
   */
  async notifyMerchant(params: {
    merchantId: string;
    type: NotificationType;
    title: string;
    content: string;
    link?: string;
    sendEmail?: boolean;
    emailTo?: string;
  }): Promise<void> {
    const notif = await this.prisma.notification.create({
      data: {
        recipientMerchantId: params.merchantId,
        type: params.type,
        title: params.title.slice(0, 255),
        content: params.content.slice(0, 65535),
        link: params.link?.slice(0, 255),
      },
    });

    if (params.sendEmail && params.emailTo) {
      this.mail
        .send({
          to: params.emailTo,
          subject: `【WM 卡密平台】${params.title}`,
          html: `<p>${params.content}</p>${params.link ? `<p><a href="${params.link}">点击查看</a></p>` : ''}`,
          text: `${params.title}\n\n${params.content}`,
        })
        .then((ok) => {
          if (ok) {
            this.prisma.notification
              .update({ where: { id: notif.id }, data: { emailSent: true } })
              .catch(() => undefined);
          }
        })
        .catch((err) => this.logger.error(`通知邮件失败: ${err.message}`));
    }
  }

  /** 给平台管理员发通知 */
  async notifyAdmin(params: {
    userId?: string;
    type: NotificationType;
    title: string;
    content: string;
    link?: string;
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        recipientUserId: params.userId ?? 'platform-admin',
        type: params.type,
        title: params.title.slice(0, 255),
        content: params.content.slice(0, 65535),
        link: params.link?.slice(0, 255),
      },
    });
  }

  /** 广播给所有商户 */
  async broadcastToAllMerchants(params: {
    type: NotificationType;
    title: string;
    content: string;
    link?: string;
  }): Promise<number> {
    const merchants = await this.prisma.merchant.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (merchants.length === 0) return 0;

    await this.prisma.notification.createMany({
      data: merchants.map((m) => ({
        recipientMerchantId: m.id,
        type: params.type,
        title: params.title.slice(0, 255),
        content: params.content.slice(0, 65535),
        link: params.link?.slice(0, 255),
      })),
    });
    return merchants.length;
  }

  /** 商户查看通知列表 */
  async listForMerchant(merchantId: string, query: { page: number; pageSize: number; onlyUnread?: boolean }) {
    const where: Prisma.NotificationWhereInput = { recipientMerchantId: merchantId };
    if (query.onlyUnread) where.isRead = false;
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { recipientMerchantId: merchantId, isRead: false } }),
    ]);
    return { items, total, unreadCount, page: query.page, pageSize: query.pageSize };
  }

  /** 平台查看通知列表 */
  async listForAdmin(query: { page: number; pageSize: number }) {
    const where: Prisma.NotificationWhereInput = { recipientUserId: { not: null } };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 标记已读 */
  async markAsRead(id: string, merchantId?: string) {
    const where: Prisma.NotificationWhereInput = { id };
    if (merchantId) where.recipientMerchantId = merchantId;
    const notif = await this.prisma.notification.findFirst({ where });
    if (!notif) throw new BadRequestException('通知不存在');
    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return { ok: true };
  }

  /** 全部已读 */
  async markAllRead(merchantId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientMerchantId: merchantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  }
}
