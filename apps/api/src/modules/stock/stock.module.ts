import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { CryptoUtil } from '../../common/utils/crypto.util';

@Module({
  controllers: [StockController],
  providers: [StockService, CryptoUtil],
  exports: [StockService],
})
export class StockModule {}
