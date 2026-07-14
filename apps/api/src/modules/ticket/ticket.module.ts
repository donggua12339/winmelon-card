import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { IdModule } from '../../infrastructure/id/id.module';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuditLogModule, IdModule, MailModule, NotificationModule],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
