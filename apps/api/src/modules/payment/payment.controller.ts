import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { UsdtService } from './usdt.service';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '../../common/decorators/throttle.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';

class CreatePaymentDto {
  @IsString()
  orderId!: string;

  @IsIn(['epay', 'mock', 'usdt', 'wechat'])
  channel!: string;
}

class UpdateChannelDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() isAvailable?: boolean;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

@ApiTags('payment')
@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly usdtService: UsdtService,
  ) {}

  /** 买家发起支付 */
  @Post('payments')
  @Public()
  @Throttle({ perMin: 10 })
  async create(@Body() dto: CreatePaymentDto, @Req() req: Request) {
    return this.paymentService.createPayment(dto.orderId, dto.channel, {
      ip: req.ip ?? '',
      requestId: req.id,
    });
  }

  /** 异步回调（通道调用） */
  @Post('payment/notify/:channel')
  @Public()
  @HttpCode(200)
  async notify(@Param('channel') channel: string, @Req() req: Request & { rawBody?: string }) {
    // rawBody 由 main.ts 启用 verify 钩子填充
    const raw = req.rawBody ?? '';
    const text = typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8');
    const result = await this.paymentService.handleNotify(
      channel,
      text,
      req.headers as Record<string, string | undefined>,
    );
    return result;
  }

  /** 同步跳转 */
  @Get('payment/return/:channel')
  @Public()
  async return(@Param('channel') channel: string, @Query() query: Record<string, string>) {
    return this.paymentService.handleReturn(channel, query);
  }

  /** 模拟支付：买家点击"已支付"触发 */
  @Post('payment/mock-pay')
  @Public()
  @Throttle({ perMin: 10 })
  async mockPay(@Body() body: { orderNo: string }) {
    await this.paymentService.triggerMockPay(body.orderNo);
    return { ok: true };
  }

  /** USDT 支付信息：钱包地址、金额、过期时间 */
  @Get('payment/usdt/info/:orderNo')
  @Public()
  async usdtInfo(@Param('orderNo') orderNo: string) {
    return this.usdtService.getPaymentInfo(orderNo);
  }

  /** 微信支付状态轮询：WechatPay 页扫码后轮询订单状态 */
  @Get('payment/wechat/status/:orderNo')
  @Public()
  async wechatStatus(@Param('orderNo') orderNo: string) {
    return this.paymentService.getWechatStatus(orderNo);
  }

  /** 后台：通道列表 */
  @Get('admin/payment-channels')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
  async listChannels() {
    return this.paymentService.listChannels();
  }

  /** 后台：通道详情（含解密配置） */
  @Get('admin/payment-channels/:code')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async getChannel(@Param('code') code: string) {
    return this.paymentService.getChannelConfig(code);
  }

  /** 后台：更新通道配置 */
  @Put('admin/payment-channels/:code')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async updateChannel(
    @Param('code') code: string,
    @Body() dto: UpdateChannelDto,
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.paymentService.updateChannel(code, dto, {
      userId: user.userId,
      userName: user.username,
      ip: req.ip,
      ua: req.get('user-agent'),
    });
  }
}
