import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SeekallWebhookService } from './seekall-webhook.service';

@Module({
  imports: [PrismaModule],
  providers: [SeekallWebhookService],
  exports: [SeekallWebhookService],
})
export class WebhookModule {}
