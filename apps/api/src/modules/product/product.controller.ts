import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProductService, type AuditCtx } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload, @Query() query: ProductQueryDto) {
    if (!user.merchantId) {
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
    return this.productService.list(user.merchantId, query);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    if (!user.merchantId) {
      return { error: 'no-merchant' };
    }
    return this.productService.findOne(user.merchantId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
  ) {
    this.requireMerchant(user);
    const ctx = this.ctx(user, req);
    return this.productService.create(user.merchantId!, dto.shopId, dto, ctx);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    this.requireMerchant(user);
    const ctx = this.ctx(user, req);
    return this.productService.update(user.merchantId!, id, dto, ctx);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
    @Req() req: Request,
  ) {
    this.requireMerchant(user);
    const ctx = this.ctx(user, req);
    return this.productService.updateStatus(user.merchantId!, id, dto.status, ctx);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    this.requireMerchant(user);
    const ctx = this.ctx(user, req);
    await this.productService.delete(user.merchantId!, id, ctx);
    return { ok: true };
  }

  private requireMerchant(user: CurrentUserPayload): void {
    if (!user.merchantId) {
      throw new Error('当前账号未绑定商户，无法操作商品');
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
