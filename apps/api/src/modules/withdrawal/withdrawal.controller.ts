import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { WithdrawalService } from './withdrawal.service';
import { IsEnum, IsNumber, IsObject, IsString, Max, MaxLength, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Throttle } from '../../common/decorators/throttle.decorator';
import { ApiTags } from '@nestjs/swagger';
import { WithdrawalStatus } from '@prisma/client';

class ApplyDto {
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  amount!: number;

  @IsEnum(['ALIPAY', 'WECHAT', 'BANK', 'USDT'])
  method!: 'ALIPAY' | 'WECHAT' | 'BANK' | 'USDT';

  @IsObject()
  accountInfo!: { account: string; name: string; bankName?: string };
}

class RejectDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

class MarkPaidDto {
  @IsString()
  @MaxLength(128)
  transferRef!: string;
}

@ApiTags('withdrawal')
@Controller('withdrawal')
export class WithdrawalController {
  constructor(private readonly service: WithdrawalService) {}

  // ============== 商户端 ==============

  @Get('merchant/balance')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  async getBalance(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.getBalance(user.merchantId);
  }

  @Post('merchant/apply')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  @Throttle({ perMin: 5 })
  async apply(@CurrentUser() user: CurrentUserPayload, @Body() dto: ApplyDto, @Req() req: Request) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.apply(user.merchantId, dto, {
      userId: user.userId,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  @Get('merchant/list')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT')
  async listMerchant(
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: WithdrawalStatus,
  ) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.listForMerchant(user.merchantId, {
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
    });
  }

  // ============== 平台端 ==============

  @Get('admin/list')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async listAdmin(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: WithdrawalStatus,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.listForAdmin({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
      keyword,
    });
  }

  @Post('admin/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async approve(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    return this.service.approve(
      {
        userId: user.userId,
        username: user.username,
        ip: req.ip ?? '',
        ua: req.get('user-agent') ?? '',
      },
      id,
    );
  }

  @Post('admin/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async reject(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @Req() req: Request,
  ) {
    return this.service.reject(
      {
        userId: user.userId,
        username: user.username,
        ip: req.ip ?? '',
        ua: req.get('user-agent') ?? '',
      },
      id,
      dto.reason,
    );
  }

  @Post('admin/:id/paid')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async markPaid(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @Req() req: Request,
  ) {
    return this.service.markPaid(
      {
        userId: user.userId,
        username: user.username,
        ip: req.ip ?? '',
        ua: req.get('user-agent') ?? '',
      },
      id,
      dto.transferRef,
    );
  }
}
