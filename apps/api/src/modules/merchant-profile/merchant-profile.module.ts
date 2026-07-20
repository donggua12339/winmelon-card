import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MerchantProfileService } from './merchant-profile.service';
import { MerchantProfileController } from './merchant-profile.controller';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { ImpersonateController } from './impersonate.controller';
import { AdminMerchantInviteController } from './admin-merchant-invite.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PageViewModule } from '../page-view/page-view.module';
import { InviteModule } from '../invite/invite.module';

@Module({
  imports: [JwtModule.register({}), AuditLogModule, PageViewModule, InviteModule],
  controllers: [
    MerchantProfileController,
    MerchantDashboardController,
    ImpersonateController,
    AdminMerchantInviteController,
  ],
  providers: [MerchantProfileService],
  exports: [MerchantProfileService],
})
export class MerchantProfileModule {}
