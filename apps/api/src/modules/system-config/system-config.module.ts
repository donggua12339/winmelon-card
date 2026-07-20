import { Global, Module } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { AdminSystemConfigController } from './admin-system-config.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Global()
@Module({
  imports: [AuditLogModule],
  providers: [SystemConfigService],
  controllers: [AdminSystemConfigController],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
