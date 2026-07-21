import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SeekallWebhookService } from './seekall-webhook.service';
import { XiaochengjianWebhookService } from './xiaochengjian-webhook.service';

@Module({
  imports: [PrismaModule],
  providers: [SeekallWebhookService, XiaochengjianWebhookService],
  exports: [SeekallWebhookService, XiaochengjianWebhookService],
})
export class WebhookModule {}
