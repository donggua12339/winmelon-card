import { Module } from '@nestjs/common';
import { WithdrawalController } from './withdrawal.controller';
import { WithdrawalService } from './withdrawal.service';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [MailModule, AuditLogModule],
  controllers: [WithdrawalController],
  providers: [WithdrawalService],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
