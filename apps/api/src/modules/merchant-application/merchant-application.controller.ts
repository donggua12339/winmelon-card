import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MerchantApplicationService } from './merchant-application.service';
import { ApplyMerchantDto } from './dto/apply-merchant.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

class RejectDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

@ApiTags('merchant-application')
@Controller()
export class MerchantApplicationController {
  constructor(private readonly service: MerchantApplicationService) {}

  /** 商户入驻申请（公开） */
  @Post('merchant/apply')
  @Public()
  async apply(@Body() dto: ApplyMerchantDto) {
    return this.service.apply(dto);
  }

  /** 管理员：申请列表 */
  @Get('admin/merchant-applications')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async list(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('status') status?: string) {
    return this.service.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
    });
  }

  /** 管理员：审核通过 */
  @Post('admin/merchant-applications/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async approve(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.approve(id, { userId: user.userId, username: user.username });
  }

  /** 管理员：审核拒绝 */
  @Post('admin/merchant-applications/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentUser() user: CurrentUserPayload) {
    return this.service.reject(id, dto.reason, { userId: user.userId, username: user.username });
  }
}
