import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CouponService } from './coupon.service';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type as TransformType } from 'class-transformer';

class CreateCouponDto {
  @IsEnum(['PERCENT', 'AMOUNT', 'FREE_SHIPPING'])
  type!: 'PERCENT' | 'AMOUNT' | 'FREE_SHIPPING';

  @TransformType(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  value!: number;

  @IsOptional() @TransformType(() => Number) @IsNumber() @Min(0) minSpend?: number;

  @IsOptional() validFrom?: string;
  @IsOptional() validTo?: string;

  @IsOptional() @TransformType(() => Number) @IsNumber() @Min(1) usageLimit?: number;

  @IsOptional() @IsString() @MaxLength(36) shopId?: string;
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}

@ApiTags('coupon')
@Controller()
export class CouponController {
  constructor(private readonly service: CouponService) {}

  /** SUPER_ADMIN 创建券 */
  @Post('admin/coupons')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCouponDto, @Req() req: Request) {
    return this.service.create(
      {
        type: dto.type as 'PERCENT' | 'AMOUNT' | 'FREE_SHIPPING',
        value: dto.value,
        minSpend: dto.minSpend,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        usageLimit: dto.usageLimit,
        shopId: dto.shopId,
        note: dto.note,
      },
      { userId: user.userId, username: user.username, ip: req.ip, ua: req.get('user-agent') ?? '' },
    );
  }

  /** admin 列表 */
  @Get('admin/coupons')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MERCHANT')
  async list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** SUPER_ADMIN 删除券 */
  @Delete('admin/coupons/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    return this.service.delete(id, {
      userId: user.userId,
      username: user.username,
      ip: req.ip,
      ua: req.get('user-agent') ?? '',
    });
  }
}
