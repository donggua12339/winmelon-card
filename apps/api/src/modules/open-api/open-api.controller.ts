import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyAuthGuard, type ApiKeyRequest } from './api-key.guard';
import { ProductService, type AuditCtx } from '../product/product.service';
import { StockService } from '../stock/stock.service';
import { OrderService } from '../order/order.service';
import { CreateProductDto } from '../product/dto/create-product.dto';
import { UpdateProductDto } from '../product/dto/update-product.dto';
import { ProductQueryDto } from '../product/dto/product-query.dto';
import { StockQueryDto } from '../stock/dto/stock-query.dto';
import { ImportStockDto } from '../stock/dto/import-stock.dto';

@ApiTags('open-api')
@ApiBearerAuth('ApiKey')
@Public()
@Controller('open/v1')
@UseGuards(ApiKeyAuthGuard)
export class OpenApiController {
  constructor(
    private readonly productService: ProductService,
    private readonly stockService: StockService,
    private readonly orderService: OrderService,
  ) {}

  private ctx(req: Request): AuditCtx {
    return {
      actorId: 'api-key',
      ip: req.ip ?? '',
      userAgent: req.get('user-agent') ?? '',
      requestId: (req.headers['x-request-id'] as string) ?? '',
    };
  }

  // ============== 商品 ==============

  @Get('products')
  @ApiOperation({ summary: '商品列表' })
  async listProducts(@Req() req: Request & ApiKeyRequest, @Query() query: ProductQueryDto) {
    return this.productService.list(req.apiKey!.merchantId, query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: '商品详情' })
  async getProduct(@Req() req: Request & ApiKeyRequest, @Param('id') id: string) {
    return this.productService.findOne(req.apiKey!.merchantId, id);
  }

  @Post('products')
  @ApiOperation({ summary: '创建商品' })
  async createProduct(@Req() req: Request & ApiKeyRequest, @Body() dto: CreateProductDto) {
    return this.productService.create(req.apiKey!.merchantId, dto.shopId, dto, this.ctx(req));
  }

  @Post('products/:id/update')
  @ApiOperation({ summary: '更新商品（POST 替代 PUT，方便对接）' })
  async updateProduct(@Req() req: Request & ApiKeyRequest, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(req.apiKey!.merchantId, id, dto, this.ctx(req));
  }

  // ============== 卡密 ==============

  @Get('stock')
  @ApiOperation({ summary: '卡密列表' })
  async listStock(@Req() req: Request & ApiKeyRequest, @Query() query: StockQueryDto) {
    return this.stockService.list(req.apiKey!.merchantId, query);
  }

  @Post('stock/import')
  @ApiOperation({ summary: '批量导入卡密（CSV）' })
  async importStock(@Req() req: Request & ApiKeyRequest, @Body() dto: ImportStockDto) {
    return this.stockService.import(req.apiKey!.merchantId, dto, this.ctx(req));
  }

  @Get('stock/stats/:productId')
  @ApiOperation({ summary: '卡密库存统计' })
  async stockStats(@Req() req: Request & ApiKeyRequest, @Param('productId') productId: string) {
    return this.stockService.stats(req.apiKey!.merchantId, productId);
  }

  // ============== 订单 ==============

  @Get('orders')
  @ApiOperation({ summary: '订单列表' })
  async listOrders(
    @Req() req: Request & ApiKeyRequest,
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
    @Query('status') status?: string,
  ) {
    return this.orderService.listForAdmin(req.apiKey!.merchantId, {
      page: Number(page),
      pageSize: Number(pageSize),
      status,
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '订单详情' })
  async getOrder(@Req() req: Request & ApiKeyRequest, @Param('id') id: string) {
    return this.orderService.findOneForAdmin(req.apiKey!.merchantId, id);
  }
}
