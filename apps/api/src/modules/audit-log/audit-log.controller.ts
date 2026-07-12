import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('admin/audit-logs')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('actorName') actorName?: string,
    @Query('ip') ip?: string,
    @Query('requestId') requestId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLog.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      action,
      resourceType,
      actorName,
      ip,
      requestId,
      startDate,
      endDate,
    });
  }

  @Get('stats')
  async stats(@Query('days') days?: string) {
    return this.auditLog.stats(days ? Number(days) : 7);
  }
}
