import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

const DOMAIN_REGEX = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

@Injectable()
export class ShopDomainService {
  private readonly logger = new Logger(ShopDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** 获取店铺的域名配置 */
  async getDomain(merchantId: string, shopId: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, merchantId },
      select: {
        id: true,
        code: true,
        customDomain: true,
        domainVerified: true,
        domainVerifiedAt: true,
        domainVerifyToken: true,
      },
    });
    if (!shop) throw new NotFoundException('店铺不存在或无权访问');

    return {
      shopId: shop.id,
      shopCode: shop.code,
      customDomain: shop.customDomain,
      verified: shop.domainVerified,
      verifiedAt: shop.domainVerifiedAt,
      // 仅在未验证时返回 token（让用户复制去配 DNS）
      verifyToken: shop.customDomain && !shop.domainVerified ? shop.domainVerifyToken : null,
      // 提示文案：用户复制这条记录去域名 DNS 添加
      dnsInstruction: shop.customDomain
        ? {
            type: 'TXT',
            host: `_wm-verify.${shop.customDomain}`,
            value: shop.domainVerifyToken,
            ttl: 300,
          }
        : null,
    };
  }

  /** 设置/修改自定义域名（生成新 token） */
  async setDomain(merchantId: string, shopId: string, domain: string, ctx: { userId: string; ip: string; ua: string }) {
    const normalized = domain.trim().toLowerCase();
    if (!DOMAIN_REGEX.test(normalized)) {
      throw new BadRequestException('域名格式不正确（如 shop.example.com）');
    }
    if (normalized.endsWith('.winmelon.cn')) {
      throw new BadRequestException('不能使用平台主域名');
    }

    // 校验店铺归属
    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, merchantId },
    });
    if (!shop) throw new NotFoundException('店铺不存在或无权访问');

    // 校验全局唯一
    const conflict = await this.prisma.shop.findFirst({
      where: {
        customDomain: normalized,
        NOT: { id: shopId },
      },
    });
    if (conflict) {
      throw new ConflictException(`域名 ${normalized} 已被其他店铺占用`);
    }

    const token = `wmcard-${randomBytes(16).toString('hex')}`;
    await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        customDomain: normalized,
        domainVerified: false,
        domainVerifiedAt: null,
        domainVerifyToken: token,
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'shop.domain.set',
      resourceType: 'shop',
      resourceId: shopId,
      afterData: { customDomain: normalized },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    return {
      customDomain: normalized,
      verified: false,
      verifyToken: token,
      dnsInstruction: {
        type: 'TXT',
        host: `_wm-verify.${normalized}`,
        value: token,
        ttl: 300,
        note: '请到域名 DNS 添加这条 TXT 记录，然后调用验证接口',
      },
    };
  }

  /** 查询 DNS TXT 记录并验证 */
  async verifyDomain(merchantId: string, shopId: string, ctx: { userId: string; ip: string; ua: string }) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, merchantId, customDomain: { not: null } },
      select: { id: true, customDomain: true, domainVerifyToken: true },
    });
    if (!shop || !shop.customDomain || !shop.domainVerifyToken) {
      throw new BadRequestException('尚未设置自定义域名');
    }

    const host = `_wm-verify.${shop.customDomain}`;
    const expected = shop.domainVerifyToken;
    const txtRecords = await this.queryDnsTxt(host);

    const matched = txtRecords.some((r) => r.toLowerCase() === expected.toLowerCase());

    if (!matched) {
      throw new BadRequestException(
        `未找到匹配的 TXT 记录。请先在域名 DNS 添加：\n  ${host} -> ${expected}\n当前查到：${txtRecords.length ? txtRecords.join(', ') : '(空)'}`,
      );
    }

    await this.prisma.shop.update({
      where: { id: shop.id },
      data: {
        domainVerified: true,
        domainVerifiedAt: new Date(),
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'shop.domain.verify',
      resourceType: 'shop',
      resourceId: shopId,
      afterData: { customDomain: shop.customDomain },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    this.logger.log(`自定义域名已验证：shop=${shopId} domain=${shop.customDomain}`);

    return {
      customDomain: shop.customDomain,
      verified: true,
      verifiedAt: new Date(),
      nextStep: '将域名 CNAME/A 指向平台服务器，并在 Nginx 启用对应 server 块',
    };
  }

  /** 移除自定义域名 */
  async removeDomain(merchantId: string, shopId: string, ctx: { userId: string; ip: string; ua: string }) {
    const shop = await this.prisma.shop.findFirst({
      where: { id: shopId, merchantId },
      select: { id: true, customDomain: true },
    });
    if (!shop) throw new NotFoundException('店铺不存在或无权访问');

    await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        customDomain: null,
        domainVerified: false,
        domainVerifiedAt: null,
        domainVerifyToken: null,
      },
    });

    await this.auditLog.record({
      actorId: ctx.userId,
      action: 'shop.domain.remove',
      resourceType: 'shop',
      resourceId: shopId,
      beforeData: { customDomain: shop.customDomain },
      ip: ctx.ip,
      userAgent: ctx.ua,
    });

    return { ok: true };
  }

  /** 查询 DNS TXT 记录（多 DNS 尝试） */
  private async queryDnsTxt(host: string): Promise<string[]> {
    // 使用 Node 内置 dns 模块（基础解析）
    const dns = await import('dns').then((m) => m.promises);
    try {
      const records = await dns.resolveTxt(host);
      // resolveTxt 返回 string[][]，每个子数组是一组串联的字符串片段
      return records.map((parts) => parts.join(''));
    } catch {
      return [];
    }
  }
}
