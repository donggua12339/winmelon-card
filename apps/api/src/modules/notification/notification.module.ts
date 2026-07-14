import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationTriggerService } from './notification-trigger.service';
import { MailModule } from '../../infrastructure/mail/mail.module';

@Module({
  imports: [MailModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationTriggerService],
  exports: [NotificationService, NotificationTriggerService],
})
export class NotificationModule {}
