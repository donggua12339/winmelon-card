import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

@ApiTags('admin-products')
@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly prisma: PrismaService,
  ) {}

  /** SUPER_ADMIN 不受 merchantId 限制：返回真实 shop 的 merchantId */
  private async resolveMerchantId(user: CurrentUserPayload, shopId: string): Promise<string> {
    if (user.roles.includes('SUPER_ADMIN')) {
      const shop = await this.prisma.shop.findUnique({
        where: { id: shopId },
        select: { merchantId: true },
      });
      if (!shop) {
        throw new BadRequestException(`店铺 ${shopId} 不存在`);
      }
      return shop.merchantId;
    }
    if (!user.merchantId) {
      throw new BadRequestException('用户未关联商户');
    }
    return user.merchantId;
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload, @Query() query: ProductQueryDto) {
    // SUPER_ADMIN 不传 merchantId 也返回全平台商品；其他角色必须有 merchantId
    const merchantId = user.roles.includes('SUPER_ADMIN') ? undefined : user.merchantId;
    if (merchantId === undefined && !user.roles.includes('SUPER_ADMIN')) {
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
    return this.productService.list(merchantId, query);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const merchantId = user.roles.includes('SUPER_ADMIN') ? undefined : user.merchantId;
    if (merchantId === undefined && !user.roles.includes('SUPER_ADMIN')) {
      return { error: 'no-merchant' };
    }
    return this.productService.findOne(merchantId, id);
  }

  @Post()
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateProductDto, @Req() req: Request) {
    const merchantId = await this.resolveMerchantId(user, dto.shopId);
    const ctx = this.ctx(user, req);
    return this.productService.create(merchantId, dto.shopId, dto, ctx);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    const merchantId = await this.resolveMerchantIdByProduct(user, id);
    const ctx = this.ctx(user, req);
    return this.productService.update(merchantId, id, dto, ctx);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductStatusDto,
    @Req() req: Request,
  ) {
    const merchantId = await this.resolveMerchantIdByProduct(user, id);
    const ctx = this.ctx(user, req);
    return this.productService.updateStatus(merchantId, id, dto.status, ctx);
  }

  @Delete(':id')
  async delete(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    const merchantId = await this.resolveMerchantIdByProduct(user, id);
    const ctx = this.ctx(user, req);
    await this.productService.delete(merchantId, id, ctx);
    return { ok: true };
  }

  /** 通过商品 ID 反查真实 merchantId（同样支持 SUPER_ADMIN） */
  private async resolveMerchantIdByProduct(user: CurrentUserPayload, productId: string): Promise<string> {
    if (user.roles.includes('SUPER_ADMIN')) {
      const p = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { merchantId: true },
      });
      if (!p) throw new BadRequestException(`商品 ${productId} 不存在`);
      return p.merchantId;
    }
    if (!user.merchantId) throw new BadRequestException('当前账号未绑定商户');
    return user.merchantId;
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
