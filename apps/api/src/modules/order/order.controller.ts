import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '../../common/decorators/throttle.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags } from '@nestjs/swagger';

class AdminOrderQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() keyword?: string;
}

@ApiTags('order')
@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** 买家下单（公开） */
  @Post('shop/:code/orders')
  @Public()
  @Throttle({ perMin: 10 })
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    return this.orderService.create(dto, {
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
      requestId: req.id,
    });
  }

  /** 买家查询订单（公开，但限流严格防爆破） */
  @Post('orders/query')
  @Public()
  @Throttle({ perMin: 5 })
  async query(@Body() dto: QueryOrderDto) {
    return this.orderService.findByOrderNo(dto.orderNo, dto.buyerEmail);
  }

  /** 后台：订单列表 */
  @Get('admin/orders')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
  async list(@CurrentUser() user: CurrentUserPayload, @Query() query: AdminOrderQueryDto) {
    return this.orderService.listForAdmin(user.merchantId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
      keyword: query.keyword,
    });
  }

  /** 后台：订单详情 */
  @Get('admin/orders/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
  async detail(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.orderService.findOneForAdmin(user.merchantId, id);
  }
}
