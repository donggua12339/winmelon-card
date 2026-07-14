import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class MerchantPaymentChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * 商户查看自己启用的支付通道
   * 返回所有平台通道 + 商户是否启用
   */
  async listForMerchant(merchantId: string) {
    const [platformChannels, merchantChannels] = await Promise.all([
      this.prisma.paymentChannel.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, code: true, name: true, isAvailable: true, updatedAt: true },
      }),
      this.prisma.merchantPaymentChannel.findMany({
        where: { merchantId },
        select: { channelCode: true, isEnabled: true },
      }),
    ]);
    const merchantMap = new Map(merchantChannels.map((m) => [m.channelCode, m.isEnabled]));
    return platformChannels.map((p) => ({
      code: p.code,
      name: p.name,
      platformAvailable: p.isAvailable,
      merchantEnabled: merchantMap.get(p.code) ?? false,
      // 平台禁用的通道商户也不能启用
      canEnable: p.isAvailable,
    }));
  }

  /** 商户切换通道启用状态 */
  async toggle(
    merchantId: string,
    channelCode: string,
    isEnabled: boolean,
    ctx: { userId: string; username: string; ip?: string; ua?: string },
  ) {
    // 校验平台通道存在且可用
    const channel = await this.prisma.paymentChannel.findUnique({ where: { code: channelCode } });
    if (!channel) throw new NotFoundException(`支付通道 ${channelCode} 不存在`);
    if (isEnabled && !channel.isAvailable) {
      throw new BadRequestException(`平台已禁用通道 ${channelCode}，无法启用`);
    }

    // upsert 商户通道配置
    await this.prisma.merchantPaymentChannel.upsert({
      where: { merchantId_channelCode: { merchantId, channelCode } },
      update: { isEnabled },
      create: { merchantId, channelCode, isEnabled },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      actorName: ctx.username,
      action: 'merchant_payment_channel.toggle',
      resourceType: 'merchant_payment_channel',
      resourceId: `${merchantId}:${channelCode}`,
      afterData: { channelCode, isEnabled },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    return { channelCode, isEnabled };
  }

  /**
   * 买家侧：查询店铺可用的支付通道
   * = 平台可用 AND 商户启用
   */
  async listForShop(shopId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { merchantId: true },
    });
    if (!shop) return [];

    const [platformChannels, merchantChannels] = await Promise.all([
      this.prisma.paymentChannel.findMany({
        where: { isAvailable: true },
        orderBy: { createdAt: 'asc' },
        select: { code: true, name: true },
      }),
      this.prisma.merchantPaymentChannel.findMany({
        where: { merchantId: shop.merchantId, isEnabled: true },
        select: { channelCode: true },
      }),
    ]);
    const enabledSet = new Set(merchantChannels.map((m) => m.channelCode));
    return platformChannels.filter((p) => enabledSet.has(p.code));
  }

  /**
   * 校验商户是否启用了某通道（payment.service.createPayment 调用）
   */
  async isChannelEnabledForMerchant(merchantId: string, channelCode: string): Promise<boolean> {
    const mc = await this.prisma.merchantPaymentChannel.findUnique({
      where: { merchantId_channelCode: { merchantId, channelCode } },
      select: { isEnabled: true },
    });
    return mc?.isEnabled ?? false;
  }

  /**
   * 初始化商户通道（商户入驻时调用，默认启用所有平台可用通道）
   */
  async initForNewMerchant(merchantId: string): Promise<void> {
    const channels = await this.prisma.paymentChannel.findMany({
      where: { isAvailable: true },
      select: { code: true },
    });
    if (channels.length === 0) return;
    await this.prisma.merchantPaymentChannel.createMany({
      data: channels.map((c) => ({ merchantId, channelCode: c.code, isEnabled: true })),
      skipDuplicates: true,
    });
  }
}
