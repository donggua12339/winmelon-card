import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * 商户自定义域名中间件
 *
 * 根据请求 Host 头查找 Shop.customDomain，把请求重写到 /shop/:shopCode/* 路径。
 * - 对 GET 和 POST 请求都生效（P2-13：让买家能在自定义域名下单）
 * - 跳过 /api、/payment、/assets、/_ 前缀
 * - 仅匹配已验证（domainVerified=true）的域名
 * - 已重写过的请求（带 x-shop-host-rewritten header）不再处理
 */
@Injectable()
export class ShopHostMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ShopHostMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // P2-13: 同时处理 GET 和 POST（让买家能在自定义域名下单）
    if (req.method !== 'GET' && req.method !== 'POST') return next();
    if (!req.path || !req.path.startsWith('/')) return next();

    // 跳过 API、静态资源、内部路径
    const skipPrefixes = ['/api', '/payment', '/assets', '/_', '/favicon', '/robots.txt'];
    if (skipPrefixes.some((p) => req.path.startsWith(p))) return next();

    // 已经重写过
    if (req.headers['x-shop-host-rewritten']) return next();

    const host = (req.headers.host || '').toLowerCase().split(':')[0]; // 去掉端口
    if (!host) return next();

    // 平台主域名不算商户域名（从环境变量 MAIN_DOMAINS 读取，逗号分隔）
    const mainDomainsEnv = process.env.MAIN_DOMAINS ?? 'winmelon.cn,www.winmelon.cn,localhost';
    const mainDomains = mainDomainsEnv
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (mainDomains.some((d) => host === d || host.endsWith('.' + d))) {
      // 主域下的访问保持原样
      return next();
    }

    try {
      const shop = await this.prisma.shop.findFirst({
        where: { customDomain: host, domainVerified: true },
        select: { code: true },
      });

      if (shop) {
        const newPath = `/shop/${shop.code}${req.path === '/' ? '' : req.path}`;
        this.logger.log(`[domain] ${req.method} ${host}${req.path} -> ${newPath}`);
        // Express URL 重写
        req.url = newPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
        req.headers['x-shop-host-rewritten'] = '1';
        // 透传给 Vue Router / API Controller
        req.headers['x-original-host'] = host;
      }
    } catch (err) {
      this.logger.warn(`域名查询失败 host=${host}: ${(err as Error).message}`);
    }

    next();
  }
}
