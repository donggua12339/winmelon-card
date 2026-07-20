import { BadRequestException, Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ActivationService } from './activation.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ActivateDto } from './dto/activate.dto';
import type { LoginResult } from './dto/login-result.interface';
import type { JwtRequestUser } from './jwt.strategy';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

/** P1-6: refresh token 存的 httpOnly cookie 名 */
export const REFRESH_TOKEN_COOKIE = 'wm_refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieDomain: string;
  private readonly cookieSecure: boolean;
  private readonly cookieSameSite: 'lax' | 'strict' | 'none';

  constructor(
    private readonly authService: AuthService,
    private readonly activationService: ActivationService,
    private readonly config: ConfigService,
  ) {
    this.cookieDomain = this.config.get<string>('COOKIE_DOMAIN', '.winmelon.cn') ?? '.winmelon.cn';
    this.cookieSecure = this.config.get<string>('COOKIE_SECURE', 'true') !== 'false';
    this.cookieSameSite = this.config.get<string>('COOKIE_SAMESITE', 'lax').toLowerCase() as 'lax' | 'strict' | 'none';
  }

  @Post('login')
  @HttpCode(200)
  @Public()
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResult, 'refreshToken'>> {
    const result = await this.authService.login(dto.username, dto.password, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
    if (result.refreshToken) {
      res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, this.cookieOpts());
    }
    const { refreshToken: _r, ...rest } = result;
    return rest;
  }

  @Post('refresh')
  @HttpCode(200)
  @Public()
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResult, 'refreshToken'>> {
    const cookieRefresh = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_TOKEN_COOKIE];
    const refreshToken = cookieRefresh ?? dto.refreshToken;
    if (!refreshToken) {
      throw new BadRequestException('refresh_token 缺失（cookie 与 body 均无）');
    }
    const result = await this.authService.refresh(refreshToken, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
    if (result.refreshToken) {
      res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, this.cookieOpts());
    }
    const { refreshToken: _r, ...rest } = result;
    return rest;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request & { user?: JwtRequestUser },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const user = req.user;
    if (user) {
      await this.authService.logout(user.userId, user.jti);
    }
    // P1-6: 清 cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      domain: this.cookieDomain,
      path: '/api/auth',
    });
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

  private cookieOpts() {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      domain: this.cookieDomain,
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    } as const;
  }

  // ============== P2-8 账号激活 ==============

  /**
   * 校验激活 token 是否有效（无需设密码）
   * 用于前端 GET 时显示 token 有效性
   */
  @Post('activate/validate')
  @HttpCode(200)
  @Public()
  async activateValidate(@Body() dto: { token: string }) {
    if (!dto.token) throw new BadRequestException('token 不能为空');
    const info = await this.activationService.validate(dto.token);
    return { valid: true, email: info.email, type: info.type };
  }

  /**
   * 激活账号：设密码 + 自动登录
   */
  @Post('activate')
  @HttpCode(200)
  @Public()
  async activate(
    @Body() dto: ActivateDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    defaultRedirect: string;
    user: { id: string; username: string; email: string; roles: string[]; merchantId?: string };
  }> {
    const result = await this.activationService.activate(dto.token, dto.password, {
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
    // 激活后自动登录：set refresh cookie
    const loginResp = await this.authService.refresh(result.accessToken, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
    if (loginResp.refreshToken) {
      res.cookie(REFRESH_TOKEN_COOKIE, loginResp.refreshToken, this.cookieOpts());
    }
    const { refreshToken: _r, ...rest } = loginResp;
    return {
      ...rest,
      user: { ...rest.user, merchantId: result.user.merchantId ?? undefined },
    };
  }
}
