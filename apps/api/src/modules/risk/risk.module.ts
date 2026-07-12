import { Global, Module } from '@nestjs/common';
import { RiskControlService } from './risk-control.service';
import { RiskController } from './risk.controller';

@Global()
@Module({
  controllers: [RiskController],
  providers: [RiskControlService],
  exports: [RiskControlService],
})
export class RiskModule {}
