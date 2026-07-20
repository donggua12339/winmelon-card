import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RefundService } from './refund.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import type { JwtRequestUser } from '../auth/jwt.strategy';

@Controller()
export class RefundController {
  constructor(
    private readonly refundService: RefundService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 买家申请退款（公开接口，需订单号 + 邮箱双因子校验）
   * 与订单查询页一致的安全模型
   */
  @Post('refunds/apply')
  @Public()
  async applyByBuyer(
    @Body() body: { orderNo: string; buyerEmail: string; reason: string },
  ): Promise<{ id: string; refundNo: string; status: string }> {
    if (!body.orderNo || !body.buyerEmail || !body.reason) {
      throw new BadRequestException('订单号、邮箱、退款原因均不能为空');
    }
    const order = await this.prisma.order.findFirst({
      where: { orderNo: body.orderNo, buyerEmail: body.buyerEmail },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('订单号或邮箱不匹配');
    return this.refundService.create(order.id, { reason: body.reason, initiator: 'BUYER' });
  }

  /**
   * 平台发起退款（SUPER_ADMIN）
   */
  @Post('admin/refunds')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async createByPlatform(
    @Body() body: { orderId: string; reason: string; amount?: number },
    @CurrentUser() user: JwtRequestUser,
  ): Promise<{ id: string; refundNo: string; status: string }> {
    return this.refundService.create(
      body.orderId,
      { reason: body.reason, initiator: 'PLATFORM', amount: body.amount },
      { userId: user.userId, ip: '', ua: '' },
    );
  }

  /**
   * 平台审核通过（SUPER_ADMIN）
   */
  @Post('admin/refunds/:id/approve')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async approve(@Param('id') id: string, @CurrentUser() user: JwtRequestUser): Promise<{ id: string; status: string }> {
    return this.refundService.approve(id, { userId: user.userId, ip: '', ua: '' });
  }

  /**
   * 平台拒绝退款（SUPER_ADMIN）
   */
  @Post('admin/refunds/:id/reject')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async reject(
    @Param('id') id: string,
    @Body() body: { rejectReason: string },
    @CurrentUser() user: JwtRequestUser,
  ): Promise<{ id: string; status: string }> {
    return this.refundService.reject(id, body.rejectReason, { userId: user.userId, ip: '', ua: '' });
  }

  /**
   * 标记已打款（SUPER_ADMIN）
   * 阶段 1：manualPayout=true（线下手动打款，USDT 等）
   * 阶段 2：manualPayout=false + tradeNo（通道原路退款）
   * USDT 手动打款：manualPayout=true + usdt 三件套（txHash + senderWallet + receiverWallet）
   */
  @Post('admin/refunds/:id/mark-paid')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async markPaid(
    @Param('id') id: string,
    @Body()
    body: {
      manualPayout?: boolean;
      tradeNo?: string;
      forceOverride?: boolean;
      usdt?: { txHash: string; senderWallet: string; receiverWallet: string };
    },
    @CurrentUser() user: JwtRequestUser,
  ): Promise<{ id: string; status: string }> {
    return this.refundService.markPaid(id, body, { userId: user.userId, ip: '', ua: '' });
  }

  /**
   * 手动重试通道退款（SUPER_ADMIN）
   * 用于 admin 介入后立即重试，或 UI 按钮触发
   */
  @Post('admin/refunds/:id/retry')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async retry(@Param('id') id: string): Promise<{ id: string; status: string; retryCount: number }> {
    return this.refundService.retryRefund(id);
  }

  /**
   * 标记通道退款失败（SUPER_ADMIN 或系统调用）
   */
  @Post('admin/refunds/:id/mark-failed')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async markFailed(
    @Param('id') id: string,
    @Body() body: { error: string },
    @CurrentUser() user: JwtRequestUser,
  ): Promise<{ id: string; status: string; retryCount: number }> {
    return this.refundService.markFailed(id, body.error, { userId: user.userId, ip: '', ua: '' });
  }

  /**
   * 退款列表（SUPER_ADMIN）
   */
  @Get('admin/refunds')
  @UseGuards(JwtAuthGuard)
  @Roles('SUPER_ADMIN')
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.refundService.listForAdmin({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
      merchantId,
    });
  }
  // /admin/finance/daily-report 已迁移到 FinanceController（V4-7 多维度版）
}
