import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MerchantProfileService } from './merchant-profile.service';
import { ApiTags } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword!: string;
}

class SetThemeDto {
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: '主题色格式不正确（如 #7c3aed 或 #abc）',
  })
  color!: string;
}

@ApiTags('merchant-profile')
@Controller('merchant/profile')
@UseGuards(RolesGuard)
@Roles('MERCHANT')
export class MerchantProfileController {
  constructor(private readonly service: MerchantProfileService) {}

  @Get()
  async get(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.getProfile(user.merchantId);
  }

  @Post('theme')
  async setTheme(@CurrentUser() user: CurrentUserPayload, @Body() dto: SetThemeDto, @Req() req: Request) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.setTheme(user.merchantId, dto.color, {
      userId: user.userId,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  @Post('password')
  async changePassword(@CurrentUser() user: CurrentUserPayload, @Body() dto: ChangePasswordDto, @Req() req: Request) {
    if (!user.merchantId) throw new ForbiddenException('当前账号未绑定商户');
    return this.service.changePassword(user.merchantId, user.userId, dto, {
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }
}
