import { Module } from '@nestjs/common';
import { RiskControlService } from './risk-control.service';
import { RiskController } from './risk.controller';

@Module({
  controllers: [RiskController],
  providers: [RiskControlService],
  exports: [RiskControlService],
})
export class RiskModule {}
