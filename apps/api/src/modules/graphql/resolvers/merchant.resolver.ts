import { Args, Context, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { MerchantType } from '../types/merchant.type';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

@Resolver(() => MerchantType)
export class MerchantResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** 当前登录商户信息（需认证） */
  @Query(() => MerchantType, { description: '当前登录的商户信息' })
  @UseGuards(GqlAuthGuard)
  async me(@Context() ctx: { req: Record<string, unknown> }): Promise<MerchantType> {
    const userId = ctx.req.user?.userId;
    if (!userId) throw new NotFoundException('未登录');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { merchantId: true },
    });
    if (!user?.merchantId) throw new NotFoundException('当前用户未绑定商户');
    const m = await this.prisma.merchant.findUnique({
      where: { id: user.merchantId },
    });
    if (!m) throw new NotFoundException('商户不存在');
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

  /** 公开查询：按 code 查商户（仅返回基本信息） */
  @Query(() => MerchantType, { description: '按 code 查询商户' })
  async merchantByCode(@Args('code') code: string): Promise<MerchantType> {
    const m = await this.prisma.merchant.findUnique({ where: { code } });
    if (!m) throw new NotFoundException('商户不存在');
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
