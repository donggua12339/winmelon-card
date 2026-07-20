import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { InviteService } from './invite.service';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

class CreateCodeDto {
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}

class UpdateSettingsDto {
  @IsOptional() allowBuyerInviteCode?: boolean;
  @IsOptional()
  @IsEnum(['TOP10', 'TOP10_WITH_NEIGHBORS', 'OFF'])
  leaderboardDisplayMode?: 'TOP10' | 'TOP10_WITH_NEIGHBORS' | 'OFF';
  @IsOptional() @IsString() @MaxLength(128) leaderboardName?: string | null;
}

@ApiTags('invite')
@Controller()
export class InviteController {
  constructor(private readonly service: InviteService) {}

  /** 商户生成邀请码 */
  @Post('merchant/invite-codes')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  async createCode(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCodeDto, @Req() req: Request) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.createCode(user.merchantId, dto.note, {
      userId: user.userId,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }

  /** 商户查看自己的邀请码列表 */
  @Get('merchant/invite-codes')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async listCodes(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) return [];
    return this.service.listCodesForMerchant(user.merchantId);
  }

  /** 商户删除邀请码（未被使用的） */
  @Delete('merchant/invite-codes/:id')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  async deleteCode(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.deleteCode(user.merchantId, id);
  }

  /** 商户返佣记录 */
  @Get('merchant/commissions')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async listCommissions(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!user.merchantId) return { items: [], total: 0 };
    return this.service.listCommissionsForInviter(user.merchantId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** 商户邀请统计 */
  @Get('merchant/invite/stats')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) {
      return {
        totalCommission: 0,
        monthCommission: 0,
        codeCount: 0,
        usedCodeCount: 0,
        invitedMerchantCount: 0,
      };
    }
    return this.service.getInviteStats(user.merchantId);
  }

  /** 关系链树（下级 + 下级的下级） */
  @Get('merchant/invite/tree')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async getInviteTree(@CurrentUser() user: CurrentUserPayload, @Query('depth') depth?: string) {
    if (!user.merchantId) return { root: null, tree: [] };
    return this.service.getInviteTree(user.merchantId, depth ? Number(depth) : 2);
  }

  /** Top 10 排行榜（公开，商户名脱敏） */
  @Get('merchant/invite/leaderboard')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async getLeaderboard(
    @Query('dimension') dimension: 'invites' | 'teamSize' | 'teamGmv' = 'invites',
    @Query('period') period: 'week' | 'month' | 'all' = 'all',
  ) {
    return this.service.getLeaderboard(dimension, period);
  }

  /** 自己的排名 + 上下 2 名 */
  @Get('merchant/invite/leaderboard/me')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async getMyLeaderboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query('dimension') dimension: 'invites' | 'teamSize' | 'teamGmv' = 'invites',
    @Query('period') period: 'week' | 'month' | 'all' = 'all',
  ) {
    if (!user.merchantId) return { myRank: null, myValue: 0, neighbors: [] };
    return this.service.getMyLeaderboard(user.merchantId, dimension, period);
  }

  /** 获取分销设置 */
  @Get('merchant/invite/settings')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async getSettings(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.getSettings(user.merchantId);
  }

  /** 更新分销设置 */
  @Put('merchant/invite/settings')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  async updateSettings(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateSettingsDto) {
    if (!user.merchantId) return { error: 'no-merchant' };
    await this.service.updateSettings(user.merchantId, dto);
    return { ok: true };
  }
}
