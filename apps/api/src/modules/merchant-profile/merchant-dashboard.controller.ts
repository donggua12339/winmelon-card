import { Controller, Get, UseGuards } from '@nestjs/common';
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
  async stats(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) throw new Error('no-merchant');
    return this.service.getDashboardStats(user.merchantId);
  }
}
