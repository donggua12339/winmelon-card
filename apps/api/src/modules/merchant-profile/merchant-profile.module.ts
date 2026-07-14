import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MerchantProfileService } from './merchant-profile.service';
import { MerchantProfileController } from './merchant-profile.controller';
import { MerchantDashboardController } from './merchant-dashboard.controller';
import { ImpersonateController } from './impersonate.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PageViewModule } from '../page-view/page-view.module';

@Module({
  imports: [JwtModule.register({}), AuditLogModule, PageViewModule],
  controllers: [MerchantProfileController, MerchantDashboardController, ImpersonateController],
  providers: [MerchantProfileService],
  exports: [MerchantProfileService],
})
export class MerchantProfileModule {}
