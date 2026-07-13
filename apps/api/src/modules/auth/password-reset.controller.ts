import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '../../common/decorators/throttle.decorator';
import { PasswordResetService } from './password-reset.service';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

class SendCodeDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255)
  email!: string;
}

class ResetPasswordDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '邮箱验证码为 6 位数字' })
  code!: string;

  @IsString()
  @MinLength(8, { message: '新密码至少 8 位' })
  @MaxLength(64)
  newPassword!: string;

  @IsString()
  captchaId!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: '图形验证码为 4 位数字' })
  captchaCode!: string;
}

@ApiTags('auth-forgot-password')
@Controller()
export class PasswordResetController {
  constructor(private readonly service: PasswordResetService) {}

  /** 生成图形验证码 */
  @Get('auth/captcha')
  @Public()
  async captcha() {
    return this.service.generateCaptcha();
  }

  /** 发送邮箱验证码（公开） */
  @Post('auth/forgot-password/send-code')
  @Public()
  @Throttle({ perMin: 5 })
  async sendCode(@Body() dto: SendCodeDto, @Req() req: Request) {
    return this.service.sendCode(dto.email, {
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  /** 验证 + 重置密码 */
  @Post('auth/forgot-password/reset')
  @Public()
  @Throttle({ perMin: 5 })
  async reset(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const captchaOk = await this.service.verifyCaptcha(dto.captchaId, dto.captchaCode);
    if (!captchaOk) {
      throw new Error('图形验证码错误或已过期');
    }
    return this.service.reset(
      { email: dto.email, code: dto.code, newPassword: dto.newPassword },
      { ip: req.ip ?? '', ua: req.get('user-agent') ?? '' },
    );
  }
}
