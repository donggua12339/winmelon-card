import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('admin-api-keys')
@Controller('admin/api-keys')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class AdminApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ summary: '列出当前商户的 API Key' })
  async list(@CurrentUser() user: CurrentUserPayload) {
    if (!user.merchantId) {
      return { items: [] };
    }
    const items = await this.apiKeyService.listByMerchant(user.merchantId);
    return { items };
  }

  @Post()
  @ApiOperation({ summary: '创建 API Key（仅返回一次完整 key）' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateApiKeyDto, @Req() req: Request) {
    if (!user.merchantId) {
      return { error: 'no-merchant' };
    }
    return this.apiKeyService.create(
      user.merchantId,
      {
        name: dto.name,
        scopes: dto.scopes,
        rateLimitPerMin: dto.rateLimitPerMin,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      {
        userId: user.userId,
        ip: req.ip ?? '',
        ua: req.get('user-agent') ?? '',
      },
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: '吊销 API Key' })
  async revoke(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    if (!user.merchantId) {
      return { error: 'no-merchant' };
    }
    return this.apiKeyService.revoke(user.merchantId, id, {
      userId: user.userId,
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }
}
