import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MerchantProfileService } from './merchant-profile.service';
import { ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

class ImpersonateDto {
  @IsUUID()
  merchantId!: string;
}

class ConsumeTokenDto {
  @IsString()
  token!: string;
}

@ApiTags('merchant-impersonate')
@Controller()
export class ImpersonateController {
  constructor(private readonly service: MerchantProfileService) {}

  /** SUPER_ADMIN 生成代登录 token */
  @Post('admin/merchants/impersonate')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async generate(@CurrentUser() user: CurrentUserPayload, @Body() dto: ImpersonateDto, @Req() req: Request) {
    return this.service.impersonate(
      {
        userId: user.userId,
        ip: req.ip ?? '',
        ua: req.get('user-agent') ?? '',
      },
      dto.merchantId,
    );
  }

  /** 公开端点：使用代登录 token 换取完整登录信息（前端再用 /auth/login 走流程或新增专用端点） */
  @Post('auth/impersonate/consume')
  @Public()
  async consume(@Body() dto: ConsumeTokenDto) {
    return this.service.consumeImpersonateToken(dto.token);
  }
}
