import { Body, Controller, Post, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '../../common/decorators/throttle.decorator';
import { PageViewService } from './page-view.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

class TrackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  path!: string;
}

@ApiTags('page-view')
@Controller()
export class PageViewController {
  constructor(
    private readonly service: PageViewService,
    private readonly prisma: PrismaService,
  ) {}

  /** 买家访问店铺页面时上报（公开，严格限流防刷） */
  @Post('shop/:code/track')
  @Public()
  @Throttle({ perMin: 30 })
  async track(@Param('code') code: string, @Body() dto: TrackDto, @Req() req: Request): Promise<{ recorded: boolean }> {
    const shop = await this.prisma.shop.findFirst({
      where: { code, isOnline: true },
      select: { id: true },
    });
    if (!shop) return { recorded: false };

    return this.service.track({
      shopId: shop.id,
      path: dto.path,
      ip: req.ip ?? '',
      userAgent: req.get('user-agent'),
    });
  }
}
