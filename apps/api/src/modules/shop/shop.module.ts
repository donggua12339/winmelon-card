import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { AdminShopController } from './admin-shop.controller';
import { ShopDomainController } from './shop-domain.controller';
import { ShopDomainService } from './shop-domain.service';
import { SsrService } from './ssr.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [ShopController, AdminShopController, ShopDomainController],
  providers: [ShopService, ShopDomainService, SsrService],
  exports: [ShopService, ShopDomainService, SsrService],
})
export class ShopModule {}
