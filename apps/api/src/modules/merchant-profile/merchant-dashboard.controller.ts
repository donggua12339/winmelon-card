import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MerchantProfileService } from './merchant-profile.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('merchant-dashboard')
@Controller('merchant/dashboard')
@UseGuards(RolesGuard)
@Roles('MERCHANT')
export class MerchantDashboardController {
  constructor(private readonly service: MerchantProfileService) {}

  @Get('stats')
  async stats(@CurrentUser() user: CurrentUserPayload, @Query('shopId') shopId?: string) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.getDashboardStats(user.merchantId, shopId);
  }
}
