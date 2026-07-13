import { BadRequestException, Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginResult } from './dto/login-result.interface';
import type { JwtRequestUser } from './jwt.strategy';
import type { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Public()
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResult> {
    return this.authService.login(dto.username, dto.password, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
  }

  @Post('refresh')
  @HttpCode(200)
  @Public()
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<LoginResult> {
    return this.authService.refresh(dto.refreshToken, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request & { user?: JwtRequestUser }): Promise<{ ok: true }> {
    const user = req.user;
    if (user) {
      await this.authService.logout(user.userId, user.jti);
    }
    return { ok: true };
  }

  @Post('me')
  async me(@Req() req: Request & { user?: JwtRequestUser }): Promise<JwtRequestUser | undefined> {
    return req.user;
  }

  /** 修改当前登录用户密码（任何角色可用） */
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user?: JwtRequestUser },
  ): Promise<{ ok: true }> {
    const user = req.user;
    if (!user) throw new BadRequestException('未登录');
    return this.authService.changePassword(user.userId, dto.oldPassword, dto.newPassword, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
    });
  }
}
