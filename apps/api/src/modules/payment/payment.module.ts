import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { EpayAdapter } from './adapters/epay.adapter';
import { MockAdapter } from './adapters/mock.adapter';
import { UsdtAdapter } from './adapters/usdt.adapter';
import { WechatAdapter } from './adapters/wechat.adapter';
import { UsdtService } from './usdt.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, EpayAdapter, MockAdapter, UsdtAdapter, WechatAdapter, UsdtService],
  exports: [PaymentService],
})
export class PaymentModule {}
