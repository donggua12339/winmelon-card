import { Module } from '@nestjs/common';
import { OpenApiController } from './open-api.controller';
import { AdminApiKeyController } from './admin-api-key.controller';
import { ApiKeyService } from './api-key.service';
import { ApiKeyAuthGuard } from './api-key.guard';
import { ProductModule } from '../product/product.module';
import { StockModule } from '../stock/stock.module';
import { OrderModule } from '../order/order.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [ProductModule, StockModule, OrderModule, AuditLogModule],
  controllers: [OpenApiController, AdminApiKeyController],
  providers: [ApiKeyService, ApiKeyAuthGuard],
  exports: [ApiKeyService, ApiKeyAuthGuard],
})
export class OpenApiModule {}
