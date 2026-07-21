import { Module } from '@nestjs/common';
import { PenaltyController } from './penalty.controller';
import { PenaltyService } from './penalty.service';
import { AdminTaxController } from './admin-tax.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuditLogModule, NotificationModule],
  controllers: [PenaltyController, AdminTaxController],
  providers: [PenaltyService],
  exports: [PenaltyService],
})
export class PenaltyModule {}
