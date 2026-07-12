import { Module } from '@nestjs/common';
import { MerchantApplicationService } from './merchant-application.service';
import { MerchantApplicationController } from './merchant-application.controller';

@Module({
  controllers: [MerchantApplicationController],
  providers: [MerchantApplicationService],
  exports: [MerchantApplicationService],
})
export class MerchantApplicationModule {}
