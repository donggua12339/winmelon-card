import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ShopDomainService } from './shop-domain.service';
import { SetShopDomainDto } from './dto/set-shop-domain.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('admin-shop-domain')
@Controller('admin/shops/:shopId/domain')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT')
export class ShopDomainController {
  constructor(private readonly service: ShopDomainService) {}

  private ctx(user: CurrentUserPayload, req: Request) {
    return {
      userId: user.userId,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    };
  }

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload, @Param('shopId') shopId: string) {
    if (!user.merchantId) throw new Error('no-merchant');
    return this.service.getDomain(user.merchantId, shopId);
  }

  @Put()
  async set(
    @CurrentUser() user: CurrentUserPayload,
    @Param('shopId') shopId: string,
    @Body() dto: SetShopDomainDto,
    @Req() req: Request,
  ) {
    if (!user.merchantId) throw new Error('no-merchant');
    return this.service.setDomain(user.merchantId, shopId, dto.domain, this.ctx(user, req));
  }

  @Post('verify')
  async verify(@CurrentUser() user: CurrentUserPayload, @Param('shopId') shopId: string, @Req() req: Request) {
    if (!user.merchantId) throw new Error('no-merchant');
    return this.service.verifyDomain(user.merchantId, shopId, this.ctx(user, req));
  }

  @Delete()
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('shopId') shopId: string, @Req() req: Request) {
    if (!user.merchantId) throw new Error('no-merchant');
    return this.service.removeDomain(user.merchantId, shopId, this.ctx(user, req));
  }
}
