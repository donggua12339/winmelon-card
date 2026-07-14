import { Args, Query, Resolver } from '@nestjs/graphql';
import { Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MerchantType } from '../types/merchant.type';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { JwtRequestUser } from '../../auth/jwt.strategy';

@Injectable()
@Resolver(() => MerchantType)
export class MerchantResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 当前登录商户信息（需认证 + MERCHANT 角色）
   * F6 GraphQL 鉴权 + RolesGuard 集成
   */
  @Query(() => MerchantType, { description: '当前登录的商户信息' })
  @UseGuards(GqlAuthGuard)
  @Roles('MERCHANT')
  async me(@CurrentUser() user: JwtRequestUser): Promise<MerchantType> {
    if (!user.userId) throw new NotFoundException('未登录');
    const u = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { merchantId: true },
    });
    if (!u?.merchantId) throw new NotFoundException('当前用户未绑定商户');
    const m = await this.prisma.merchant.findUnique({
      where: { id: u.merchantId },
    });
    if (!m) throw new NotFoundException('商户不存在');
    return this.toMerchantType(m);
  }

  /** 公开查询：按 code 查商户 */
  @Query(() => MerchantType, { description: '按 code 查询商户' })
  async merchantByCode(@Args('code') code: string): Promise<MerchantType> {
    const m = await this.prisma.merchant.findUnique({ where: { code } });
    if (!m) throw new NotFoundException('商户不存在');
    return this.toMerchantType(m);
  }

  private toMerchantType(m: {
    id: string;
    code: string;
    name: string;
    contactEmail: string;
    status: string;
    balance: { toString(): string };
    freezeBalance: { toString(): string };
    totalWithdrawn: { toString(): string };
    themeColor: string | null;
    commissionRate: unknown;
    frozenReason: string | null;
    frozenAt: Date | null;
  }): MerchantType {
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      contactEmail: m.contactEmail,
      status: m.status,
      balance: Number(m.balance),
      freezeBalance: Number(m.freezeBalance),
      totalWithdrawn: Number(m.totalWithdrawn),
      themeColor: m.themeColor ?? undefined,
      commissionRate: m.commissionRate ? Math.round(Number(m.commissionRate) * 10000) : undefined,
      frozenReason: m.frozenReason ?? undefined,
      frozenAt: m.frozenAt ?? undefined,
    };
  }
}
