import { Module } from '@nestjs/common';
import { MerchantPaymentChannelController } from './merchant-payment-channel.controller';
import { MerchantPaymentChannelService } from './merchant-payment-channel.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [MerchantPaymentChannelController],
  providers: [MerchantPaymentChannelService],
  exports: [MerchantPaymentChannelService],
})
export class MerchantPaymentChannelModule {}
