import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DeliveryService } from './delivery.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

@Controller('admin/delivery')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'MERCHANT', 'STAFF')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  /** 手动补发 */
  @Post(':orderId/retry')
  async retry(@Param('orderId') orderId: string, @CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
    return this.deliveryService.manualRetry(orderId, {
      actorId: user.userId,
      actorName: user.username,
      ip: req.ip,
      requestId: req.id,
    });
  }
}
