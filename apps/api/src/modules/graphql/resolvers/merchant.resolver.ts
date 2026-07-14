import { Args, Query, Resolver } from '@nestjs/graphql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantType } from '../types/merchant.type';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
@Resolver(() => MerchantType)
export class MerchantResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => MerchantType, { description: '按 code 查询商户（公开）' })
  async merchantByCode(@Args('code') code: string): Promise<MerchantType> {
    const m = await this.prisma.merchant.findUnique({ where: { code } });
    if (!m) throw new NotFoundException('商户不存在');
    return this.toMerchantType(m);
  }

  @Query(() => MerchantType, { description: '当前登录商户（简化版，无认证）' })
  async me(): Promise<MerchantType> {
    // 简化版：返回第一个商户（用于调试 GraphQL resolver 是否被调用）
    const m = await this.prisma.merchant.findFirst();
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
