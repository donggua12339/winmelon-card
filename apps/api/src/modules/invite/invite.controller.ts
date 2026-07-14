import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { InviteService } from './invite.service';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

class CreateCodeDto {
  @IsOptional() @IsString() @MaxLength(255) note?: string;
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
}
