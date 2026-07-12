import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RiskControlService } from './risk-control.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IsEmail, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

class AddIpDto {
  @IsString() ip!: string;
  @IsString() reason!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(720) hours?: number;
}

class AddEmailDto {
  @IsEmail() email!: string;
  @IsString() reason!: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(720) hours?: number;
}

@Controller('admin/risk')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class RiskController {
  constructor(private readonly risk: RiskControlService) {}

  @Get('ip-blacklist')
  async listIp(@Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('keyword') keyword?: string) {
    return this.risk.listIpBlacklist({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      keyword,
    });
  }

  @Get('email-blacklist')
  async listEmail(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.risk.listEmailBlacklist({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      keyword,
    });
  }

  @Post('ip-blacklist')
  async addIp(@Body() dto: AddIpDto) {
    return this.risk.addIpBlacklist(dto.ip, dto.reason, dto.hours);
  }

  @Post('email-blacklist')
  async addEmail(@Body() dto: AddEmailDto) {
    return this.risk.addEmailBlacklist(dto.email, dto.reason, dto.hours);
  }

  @Delete('ip-blacklist/:id')
  async removeIp(@Param('id') id: string) {
    await this.risk.removeIpBlacklist(id);
    return { ok: true };
  }

  @Delete('email-blacklist/:id')
  async removeEmail(@Param('id') id: string) {
    await this.risk.removeEmailBlacklist(id);
    return { ok: true };
  }

  @Get('stats')
  async stats(@Query('days') days?: string) {
    return this.risk.stats(days ? Number(days) : 7);
  }

  @Get('check')
  async check(@Query('ip') ip?: string, @Query('email') email?: string) {
    const result: { ip?: { blocked: boolean; reason?: string }; email?: { blocked: boolean; reason?: string } } = {};
    if (ip) {
      const r = await this.risk.isIpBlocked(ip);
      result.ip = { blocked: !!r, reason: r?.reason };
    }
    if (email) {
      const r = await this.risk.isEmailBlocked(email);
      result.email = { blocked: !!r, reason: r?.reason };
    }
    return result;
  }
}
