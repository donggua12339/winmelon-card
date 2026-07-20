import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CacheService } from '../../infrastructure/cache/cache.service';

@Controller('admin/cache')
@UseGuards(JwtAuthGuard)
@Roles('SUPER_ADMIN')
export class CacheAdminController {
  constructor(private readonly cache: CacheService) {}

  /**
   * 缓存命中率指标（M1 验收）
   * GET /api/admin/cache/stats
   */
  @Get('stats')
  async stats() {
    return this.cache.getMetrics();
  }

  /** 重置指标（仅测试用） */
  @Get('reset')
  async reset() {
    this.cache.resetMetrics();
    return { ok: true };
  }
}
