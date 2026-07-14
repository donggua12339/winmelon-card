import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '../../common/decorators/throttle.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TicketService } from './ticket.service';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CreateTicketDto {
  @IsString() @MaxLength(32) orderNo!: string;
  @IsString() @MaxLength(255) buyerEmail!: string;
  @IsOptional() @IsEnum(['REFUND', 'DELIVERY', 'QUALITY', 'OTHER']) category?:
    'REFUND' | 'DELIVERY' | 'QUALITY' | 'OTHER';
  @IsString() @MaxLength(255) subject!: string;
  @IsString() @MaxLength(65535) description!: string;
}

class ReplyDto {
  @IsString() @MaxLength(65535) content!: string;
  @IsOptional() @IsString() buyerEmail?: string;
  @IsOptional() isInternal?: boolean;
}

class TicketQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20;
  @IsOptional() @IsString() status?: string;
}

@ApiTags('ticket')
@Controller()
export class TicketController {
  constructor(private readonly service: TicketService) {}

  // ============== 买家侧（公开，限流）==============

  @Post('tickets')
  @Public()
  @Throttle({ perMin: 5 })
  async create(@Body() dto: CreateTicketDto, @Req() req: Request) {
    return this.service.create(dto, {
      ip: req.ip ?? '',
      ua: req.get('user-agent') ?? '',
    });
  }

  @Post('tickets/:ticketNo/query')
  @Public()
  @Throttle({ perMin: 10 })
  async findByBuyer(@Param('ticketNo') ticketNo: string, @Body() body: { buyerEmail: string }) {
    return this.service.findByBuyer(ticketNo, body.buyerEmail);
  }

  @Post('tickets/:ticketNo/buyer-reply')
  @Public()
  @Throttle({ perMin: 10 })
  async replyFromBuyer(@Param('ticketNo') ticketNo: string, @Body() dto: ReplyDto) {
    if (!dto.buyerEmail) return { error: 'buyerEmail required' };
    return this.service.replyFromBuyer(ticketNo, dto.buyerEmail, dto.content);
  }

  // ============== 商户侧 ==============

  @Get('merchant/tickets')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async listForMerchant(@CurrentUser() user: CurrentUserPayload, @Query() query: TicketQueryDto) {
    if (!user.merchantId) return { items: [], total: 0 };
    return this.service.listForMerchant(user.merchantId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
    });
  }

  @Get('merchant/tickets/:id')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async findOneForMerchant(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.findOneForMerchant(user.merchantId, id);
  }

  @Post('merchant/tickets/:id/reply')
  @UseGuards(RolesGuard)
  @Roles('MERCHANT', 'STAFF')
  async replyFromMerchant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReplyDto,
    @Req() req: Request,
  ) {
    if (!user.merchantId) return { error: 'no-merchant' };
    return this.service.replyFromMerchant(user.merchantId, id, dto.content, {
      userId: user.userId,
      username: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }

  // ============== 平台侧 ==============

  @Get('admin/tickets')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async listForAdmin(@Query() query: TicketQueryDto) {
    return this.service.listForAdmin({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
    });
  }

  @Get('admin/tickets/:id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async findOneForAdmin(@Param('id') id: string) {
    return this.service.findOneForAdmin(id);
  }

  @Post('admin/tickets/:id/reply')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async replyFromAdmin(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReplyDto,
    @Req() req: Request,
  ) {
    return this.service.replyFromAdmin(id, dto.content, dto.isInternal ?? false, {
      userId: user.userId,
      username: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }

  @Post('admin/tickets/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async resolve(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Req() req: Request) {
    return this.service.resolve(id, {
      userId: user.userId,
      username: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }
}
