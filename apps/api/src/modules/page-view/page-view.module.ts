import { Module } from '@nestjs/common';
import { PageViewController } from './page-view.controller';
import { PageViewService } from './page-view.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PageViewController],
  providers: [PageViewService],
  exports: [PageViewService],
})
export class PageViewModule {}
