import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StockService } from './stock.service';
import { ImportStockDto } from './dto/import-stock.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { AuditCtx } from '../product/product.service';

@Controller('admin/stock')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('import')
  async import(@CurrentUser() user: CurrentUserPayload, @Body() dto: ImportStockDto, @Req() req: Request) {
    this.requireMerchant(user);
    return this.stockService.import(user.merchantId!, dto, this.ctx(user, req));
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload, @Query() query: StockQueryDto) {
    this.requireMerchant(user);
    return this.stockService.list(user.merchantId!, query);
  }

  @Get('stats')
  async stats(@CurrentUser() user: CurrentUserPayload, @Query('productId') productId: string) {
    this.requireMerchant(user);
    return this.stockService.stats(user.merchantId!, productId);
  }

  @Post(':id/reveal')
  async reveal(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    this.requireMerchant(user);
    return this.stockService.reveal(user.merchantId!, id, this.ctx(user, req));
  }

  @Delete(':id')
  async delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    this.requireMerchant(user);
    await this.stockService.delete(user.merchantId!, id, this.ctx(user, req));
    return { ok: true };
  }

  private requireMerchant(user: CurrentUserPayload): void {
    if (!user.merchantId) {
      throw new Error('当前账号未绑定商户，无法操作卡密');
    }
  }

  private ctx(user: CurrentUserPayload, req: Request): AuditCtx {
    return {
      actorId: user.userId,
      actorName: user.username,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id,
    };
  }
}
