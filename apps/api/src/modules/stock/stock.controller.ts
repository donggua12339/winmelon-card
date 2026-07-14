import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { StockService } from './stock.service';
import { ImportStockDto } from './dto/import-stock.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { AuditCtx } from '../product/product.service';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IsArray, IsBoolean, IsString } from 'class-validator';
import { Throttle } from '../../common/decorators/throttle.decorator';

class BatchCardIdsDto {
  @IsArray()
  @IsString({ each: true })
  cardIds!: string[];
}

class BatchLockDto extends BatchCardIdsDto {
  @IsBoolean()
  lock!: boolean;
}

@ApiTags('admin-stock')
@Controller('admin/stock')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly prisma: PrismaService,
  ) {}

  /** SUPER_ADMIN 不受 merchantId 限制：通过商品 ID 反查 */
  private async resolveMerchantId(user: CurrentUserPayload, productId: string): Promise<string | undefined> {
    if (user.roles.includes('SUPER_ADMIN')) {
      const p = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { merchantId: true },
      });
      if (!p) throw new BadRequestException(`商品 ${productId} 不存在`);
      return p.merchantId;
    }
    if (!user.merchantId) {
      throw new BadRequestException('当前账号未绑定商户，无法操作卡密');
    }
    return user.merchantId;
  }

  @Post('import')
  async import(@CurrentUser() user: CurrentUserPayload, @Body() dto: ImportStockDto, @Req() req: Request) {
    const merchantId = await this.resolveMerchantId(user, dto.productId);
    return this.stockService.import(merchantId, dto, this.ctx(user, req));
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload, @Query() query: StockQueryDto) {
    const merchantId = user.roles.includes('SUPER_ADMIN') ? undefined : user.merchantId;
    if (!merchantId && !user.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException('当前账号未绑定商户');
    }
    return this.stockService.list(merchantId, query);
  }

  @Get('stats')
  async stats(@CurrentUser() user: CurrentUserPayload, @Query('productId') productId: string) {
    const merchantId = await this.resolveMerchantId(user, productId);
    return this.stockService.stats(merchantId, productId);
  }

  @Post(':id/reveal')
  async reveal(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    // 卡密 ID 反查
    const card = await this.prisma.stockCard.findUnique({
      where: { id },
      select: { productId: true },
    });
    if (!card) throw new BadRequestException(`卡密 ${id} 不存在`);
    const merchantId = await this.resolveMerchantId(user, card.productId);
    return this.stockService.reveal(merchantId, id, this.ctx(user, req));
  }

  @Delete(':id')
  async delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    const card = await this.prisma.stockCard.findUnique({
      where: { id },
      select: { productId: true },
    });
    if (!card) throw new BadRequestException(`卡密 ${id} 不存在`);
    const merchantId = await this.resolveMerchantId(user, card.productId);
    await this.stockService.delete(merchantId, id, this.ctx(user, req));
    return { ok: true };
  }

  /** F2: 批量锁定/解锁卡密 */
  @Post('batch-lock')
  async batchLock(@CurrentUser() user: CurrentUserPayload, @Body() dto: BatchLockDto, @Req() req: Request) {
    const merchantId = user.roles.includes('SUPER_ADMIN') ? undefined : user.merchantId;
    return this.stockService.batchLock(merchantId, dto.cardIds, dto.lock, this.ctx(user, req));
  }

  /** F2: 批量删除卡密（仅 AVAILABLE 状态） */
  @Post('batch-delete')
  async batchDelete(@CurrentUser() user: CurrentUserPayload, @Body() dto: BatchCardIdsDto, @Req() req: Request) {
    const merchantId = user.roles.includes('SUPER_ADMIN') ? undefined : user.merchantId;
    return this.stockService.batchDelete(merchantId, dto.cardIds, this.ctx(user, req));
  }

  /** F2: 导出卡密到 Excel（.xlsx） */
  @Get('export-excel')
  async exportExcel(
    @CurrentUser() user: CurrentUserPayload,
    @Query('productId') productId: string,
    @Query('includeContent') includeContent: string,
    @Res() res: Response,
  ) {
    if (!user.merchantId && !user.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException('当前账号未绑定商户');
    }
    const merchantId = user.merchantId!;
    const buffer = await this.stockService.exportToExcel(merchantId, productId, includeContent === 'true');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="stock-${productId}-${Date.now()}.xlsx"`);
    res.send(buffer);
  }

  /** F2: 从 Excel 导入卡密（multipart/form-data，字段名 file） */
  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @Throttle({ perMin: 5 })
  async importExcel(
    @CurrentUser() user: CurrentUserPayload,
    @Query('productId') productId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number },
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('未上传文件');
    if (!file.originalname.match(/\.(xlsx)$/i)) {
      throw new BadRequestException('仅支持 .xlsx 格式');
    }
    const merchantId = user.roles.includes('SUPER_ADMIN') ? undefined : user.merchantId;
    return this.stockService.importFromExcel(merchantId, productId, file.buffer as Buffer, this.ctx(user, req));
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
