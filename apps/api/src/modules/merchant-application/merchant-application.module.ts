import { Module } from '@nestjs/common';
import { MerchantApplicationService } from './merchant-application.service';
import { MerchantApplicationController } from './merchant-application.controller';
import { EmailVerificationService } from './email-verification.service';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [MailModule, AuditLogModule],
  controllers: [MerchantApplicationController],
  providers: [MerchantApplicationService, EmailVerificationService],
  exports: [MerchantApplicationService, EmailVerificationService],
})
export class MerchantApplicationModule {}
