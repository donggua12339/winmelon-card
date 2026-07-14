import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MerchantPaymentChannelService } from './merchant-payment-channel.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

class ToggleDto {
  @IsBoolean()
  isEnabled!: boolean;
}

@ApiTags('merchant-payment-channel')
@Controller()
export class MerchantPaymentChannelController {
  constructor(
    private readonly service: MerchantPaymentChannelService,
    private readonly prisma: PrismaService,
  ) {}

  /** 商户查看自己启用的支付通道 */
  @Get('merchant/payment-channels')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async listForMerchant(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) return [];
    return this.service.listForMerchant(user.merchantId);
  }

  /** 商户切换通道启用 */
  @Put('merchant/payment-channels/:code')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  async toggle(
    @CurrentUser() user: CurrentUserPayload,
    @Param('code') code: string,
    @Body() dto: ToggleDto,
    @Req() req: Request,
  ) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.toggle(user.merchantId, code, dto.isEnabled, {
      userId: user.userId,
      username: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }

  /** 买家侧：查询店铺可用支付通道 */
  @Get('shop/:code/payment-channels')
  @Public()
  async listForShop(@Param('code') code: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { code, isOnline: true },
      select: { id: true },
    });
    if (!shop) return [];
    return this.service.listForShop(shop.id);
  }
}
