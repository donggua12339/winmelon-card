import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Public()
  async check(): Promise<{ status: string; db: string; redis: string; time: string }> {
    const time = new Date().toISOString();
    let db = 'ok';
    let redis = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    try {
      const pong = await this.redis.ping();
      redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      redis = 'error';
    }
    return {
      status: db === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      db,
      redis,
      time,
    };
  }
}
