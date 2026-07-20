import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SystemConfigService } from './system-config.service';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

class UpdateConfigDto {
  @IsString() @MaxLength(2000) value!: string;
}

/** 平台配置管理（SUPER_ADMIN only） */
@ApiTags('admin-system-config')
@Controller('admin/system-config')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSystemConfigController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: SystemConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** 列出所有配置项 */
  @Get()
  async list() {
    const configs = await this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
    return { items: configs };
  }

  /** 更新配置项 */
  @Put(':key')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @Req() req: Request,
  ) {
    const before = await this.prisma.systemConfig.findUnique({ where: { key } });
    const updated = await this.configService.setValue(key, dto.value);
    await this.auditLog.record({
      actorId: user.userId,
      actorName: user.username,
      action: 'system_config.update',
      resourceType: 'system_config',
      resourceId: key,
      beforeData: before ? { value: before.value } : null,
      afterData: { value: dto.value },
      ip: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
    });
    return updated;
  }
}
