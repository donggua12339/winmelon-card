import { Body, Controller, Delete, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { InviteService } from '../invite/invite.service';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

class UpdateInviterDto {
  /** 新邀请人商户 ID（null 表示解绑） */
  @IsOptional()
  @IsUUID()
  inviterMerchantId?: string | null;
}

/**
 * admin 后台商户邀请关系管理（解绑/改绑）
 * SUPER_ADMIN only，操作记审计日志，不冲正历史返佣
 */
@ApiTags('admin-merchant-invite')
@Controller('admin/merchants')
export class AdminMerchantInviteController {
  constructor(private readonly inviteService: InviteService) {}

  /** 改绑邀请人（传 inviterMerchantId=null 等同于解绑） */
  @Put(':id/inviter')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async updateInviter(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') merchantId: string,
    @Body() dto: UpdateInviterDto,
    @Req() req: Request,
  ) {
    return this.inviteService.adminUpdateInviter(merchantId, dto.inviterMerchantId ?? null, {
      userId: user.userId,
      username: user.username,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  /** 解绑邀请人（等同于 updateInviter(null)） */
  @Delete(':id/inviter')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async removeInviter(@CurrentUser() user: CurrentUserPayload, @Param('id') merchantId: string, @Req() req: Request) {
    return this.inviteService.adminUpdateInviter(merchantId, null, {
      userId: user.userId,
      username: user.username,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }
}
