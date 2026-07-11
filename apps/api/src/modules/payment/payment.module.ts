import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { EpayAdapter } from './adapters/epay.adapter';
import { MockAdapter } from './adapters/mock.adapter';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, EpayAdapter, MockAdapter],
  exports: [PaymentService],
})
export class PaymentModule {}
