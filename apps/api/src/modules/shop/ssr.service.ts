import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeHtml } from '../../common/utils/sanitize';
import { ShopService } from './shop.service';

@Injectable()
export class SsrService {
  private readonly logger = new Logger(SsrService.name);
  private readonly publicBaseUrl: string;
  private readonly htmlCache = new Map<string, { html: string; expires: number }>();
  private static CACHE_TTL_MS = 60_000; // 1 分钟缓存

  constructor(
    private readonly shopService: ShopService,
    config: ConfigService,
  ) {
    this.publicBaseUrl = config.get<string>('PUBLIC_BASE_URL', 'https://winmelon.cn');
  }

  /**
   * 渲染店铺页 HTML（SSR）
   * 包含 SEO meta + Open Graph + JSON-LD 结构化数据 + 商品列表
   * 缓存 1 分钟
   */
  async renderShopPage(code: string): Promise<string | null> {
    const cacheKey = `shop:${code}`;
    const cached = this.htmlCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.html;
    }

    try {
      const shop = await this.shopService.findShopForSeo(code);
      const html = this.buildShopHtml(shop);
      this.htmlCache.set(cacheKey, { html, expires: Date.now() + SsrService.CACHE_TTL_MS });
      return html;
    } catch (err) {
      this.logger.warn(`SSR 渲染店铺 ${code} 失败: ${(err as Error).message}`);
      return null;
    }
  }

  private buildShopHtml(shop: {
    code: string;
    name: string;
    announcement: string | null;
    customDomain: string | null;
    merchant: { name: string; contactEmail: string };
    products: Array<{
      id: string;
      name: string;
      description: string | null;
      price: { toString(): string };
      originalPrice: { toString(): string | null } | null;
    }>;
  }): string {
    const url = `${this.publicBaseUrl}/shop/${shop.code}`;
    const title = `${shop.name} - WM 卡密平台`;
    const description = shop.announcement || `欢迎光临 ${shop.name}，提供 ${shop.merchant.name} 的优质卡密。`;
    const productsJsonLd = shop.products.slice(0, 10).map((p) => ({
      '@type': 'Product',
      name: p.name,
      description: p.description || '',
      offers: {
        '@type': 'Offer',
        price: p.price.toString(),
        priceCurrency: 'CNY',
        availability: 'https://schema.org/InStock',
      },
    }));

    const productCardsHtml = shop.products
      .map(
        (p) => `
      <div class="product-card">
        <h3>${escapeHtml(p.name)}</h3>
        ${p.description ? `<p class="desc">${escapeHtml(p.description.slice(0, 100))}</p>` : ''}
        <div class="price">¥${p.price.toString()}</div>
      </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="卡密,${escapeHtml(shop.name)},${escapeHtml(shop.merchant.name)},${escapeHtml(shop.code)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <link rel="canonical" href="${url}">
  <script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: shop.name,
  description,
  url,
  seller: { '@type': 'Organization', name: shop.merchant.name },
  makesOffer: productsJsonLd,
})}
  </script>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f8fafc; }
    header { background: #fff; padding: 24px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    h1 { margin: 0 0 8px; color: #1e293b; }
    .announcement { color: #64748b; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .product-card { background: #fff; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .product-card h3 { margin: 0 0 8px; color: #1e293b; font-size: 16px; }
    .desc { color: #64748b; font-size: 13px; margin: 0 0 8px; min-height: 30px; }
    .price { color: #ef4444; font-size: 18px; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(shop.name)}</h1>
    ${shop.announcement ? `<p class="announcement">${escapeHtml(shop.announcement)}</p>` : ''}
  </header>
  <main>
    <h2>商品列表</h2>
    <div class="grid">
      ${productCardsHtml || '<p>暂无商品</p>'}
    </div>
  </main>
  <script>
    // SPA 接管：异步加载完整前端
    window.location.href = '/shop/${shop.code}';
  </script>
</body>
</html>`;
  }

  /**
   * 生成 sitemap.xml
   */
  async renderSitemap(): Promise<string> {
    const shops = await this.shopService.listAllOnlineShops();
    const urls = shops
      .map(
        (s) =>
          `  <url><loc>${this.publicBaseUrl}/shop/${s.code}</loc><lastmod>${s.updatedAt.toISOString()}</lastmod></url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${this.publicBaseUrl}/</loc></url>
${urls}
</urlset>`;
  }

  /** robots.txt */
  renderRobots(): string {
    return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /merchant/
Disallow: /api/

Sitemap: ${this.publicBaseUrl}/sitemap.xml
`;
  }
}
