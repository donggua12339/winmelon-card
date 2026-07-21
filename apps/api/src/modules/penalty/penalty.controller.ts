import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PenaltyService } from './penalty.service';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CreatePenaltyDto {
  @IsEnum(['FRAUD', 'FALSE_INVITE', 'SELF_INVITE', 'OTHER'])
  type!: 'FRAUD' | 'FALSE_INVITE' | 'SELF_INVITE' | 'OTHER';

  @IsEnum(['FREEZE_ACCOUNT', 'REVERSE_COMMISSION', 'SUSPEND_DISTRIBUTION'])
  action!: 'FREEZE_ACCOUNT' | 'REVERSE_COMMISSION' | 'SUSPEND_DISTRIBUTION';

  @IsString() @MaxLength(2000) reason!: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) amount?: number;
}

class AppealDto {
  @IsString() @MaxLength(2000) content!: string;
}

class ProcessAppealDto {
  @IsEnum(['DISMISSED', 'EXECUTED'])
  decision!: 'DISMISSED' | 'EXECUTED';
}

@ApiTags('penalty')
@Controller()
export class PenaltyController {
  constructor(private readonly service: PenaltyService) {}

  /** SUPER_ADMIN 创建处罚 */
  @Post('admin/merchants/:id/penalty')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') merchantId: string,
    @Body() dto: CreatePenaltyDto,
    @Req() req: Request,
  ) {
    return this.service.createPenalty({
      merchantId,
      type: dto.type,
      action: dto.action,
      reason: dto.reason,
      amount: dto.amount,
      operatorId: user.userId,
      operatorName: user.username,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  /** 商户提交申诉 */
  @Post('merchant/penalty/:id/appeal')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async appeal(@CurrentUser() user: CurrentUserPayload, @Param('id') penaltyId: string, @Body() dto: AppealDto) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.appealPenalty(penaltyId, user.merchantId, dto.content);
  }

  /** SUPER_ADMIN 处理申诉 */
  @Put('admin/penalty/:id/process')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async process(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') penaltyId: string,
    @Body() dto: ProcessAppealDto,
    @Req() req: Request,
  ) {
    return this.service.processAppeal(penaltyId, dto.decision, {
      userId: user.userId,
      username: user.username,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  /** 商户查看自己的处罚列表 */
  @Get('merchant/penalties')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) return { items: [] };
    const items = await this.service.listForMerchant(user.merchantId);
    return { items };
  }
}
