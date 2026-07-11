import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Module({
  controllers: [HealthController],
  providers: [],
})
export class HealthModule {}
