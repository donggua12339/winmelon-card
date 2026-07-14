import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number = 20;
  @IsOptional() @IsBoolean() onlyUnread?: boolean;
}

class BroadcastDto {
  @IsString() @MaxLength(255) title!: string;
  @IsString() @MaxLength(65535) content!: string;
  @IsOptional() @IsString() @MaxLength(255) link?: string;
}

@ApiTags('notification')
@Controller()
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  // ============== 商户端 ==============

  @Get('merchant/notifications')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async listForMerchant(@CurrentUser() user: CurrentUserPayload, @Query() query: ListQueryDto) {
    if (!user.merchantId) return { items: [], total: 0, unreadCount: 0 };
    return this.service.listForMerchant(user.merchantId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      onlyUnread: query.onlyUnread,
    });
  }

  @Post('merchant/notifications/:id/read')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async markRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.markAsRead(id, user.merchantId);
  }

  @Post('merchant/notifications/read-all')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async markAllRead(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) return { ok: true, count: 0 };
    const count = await this.service.markAllRead(user.merchantId);
    return { ok: true, count };
  }

  // ============== 平台端 ==============

  @Get('admin/notifications')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async listForAdmin(@Query() query: ListQueryDto) {
    return this.service.listForAdmin({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  }

  @Post('admin/notifications/broadcast')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async broadcast(@Body() dto: BroadcastDto) {
    const count = await this.service.broadcastToAllMerchants({
      type: 'SYSTEM',
      title: dto.title,
      content: dto.content,
      link: dto.link,
    });
    return { ok: true, recipients: count };
  }
}
