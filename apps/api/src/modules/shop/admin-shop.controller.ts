import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ShopService } from './shop.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UpdateShopDto } from './dto/update-shop.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('admin-shops')
@Controller('admin/shops')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class AdminShopController {
  constructor(
    private readonly shopService: ShopService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('me')
  async findMyShop(@CurrentUser() user: CurrentUserPayload) {
    this.requireMerchant(user);
    return this.shopService.findMyShop(user.merchantId!);
  }

  @Put(':id')
  async updateShop(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateShopDto,
    @Req() req: Request,
  ) {
    this.requireMerchant(user);
    const before = await this.shopService.findMyShop(user.merchantId!);
    const result = await this.shopService.updateShop(user.merchantId!, id, dto);
    await this.auditLog.record({
      actorId: user.userId,
      actorName: user.username,
      action: 'shop.update',
      resourceType: 'shop',
      resourceId: id,
      beforeData: { name: before.name, isOnline: before.isOnline },
      afterData: { name: result.name, isOnline: result.isOnline },
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
    return result;
  }

  private requireMerchant(user: CurrentUserPayload): void {
    if (!user.merchantId) {
      throw new Error('当前用户未关联商户');
    }
  }
}
