import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initSentry, sentryErrorHandler } from './common/sentry/sentry';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { ShopHostMiddleware } from './common/middlewares/shop-host.middleware';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import type { Request, Response, NextFunction } from 'express';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import type { NestApplication } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { validateCriticalConfig } from './infrastructure/config/config.validator';
import { SsrService } from './modules/shop/ssr.service';

async function bootstrap(): Promise<void> {
  // M2: Sentry 必须在 NestFactory.create 之前 init
  initSentry();
  const app = await NestFactory.create<NestApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);
  // 启动期校验关键密钥，缺失直接 fail fast
  validateCriticalConfig(config);
  const port = config.get<number>('PORT', 3000);
  const prefix = config.get<string>('API_PREFIX', 'api');
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  // P2-2: 生产环境默认关闭 Swagger，避免 API 结构泄露
  const enableSwagger = config.get<string>('ENABLE_SWAGGER', 'false') !== 'false';

  app.setGlobalPrefix(prefix);

  // 信任反代（Nginx 在前），让 req.ip 解析 X-Forwarded-For
  // 仅信任 loopback 和已知代理 IP，避免攻击者伪造 XFF 绕过限流
  const trustProxy = config.get<string>('TRUST_PROXY', 'loopback');
  const httpAdapter = app.getHttpAdapter();
  const expressInstance = httpAdapter.getInstance();
  if (typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', trustProxy);
  }

  // P2-1: CORS 动态允许商户已验证的自定义域名
  // 提前获取 prismaService 供 CORS callback 使用
  const prismaServiceForCors = app.get(PrismaService);

  // CORS preflight 短路：必须在 enableCors 之前，否则 OPTIONS 带 body 会 500
  // 自己设置 CORS headers + 204，避免依赖 cors 中间件在 NestJS app 初始化前的时序问题
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      const allowedOrigins = frontendUrl.split(',').map((s) => s.trim());
      if (!origin || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id,X-Idempotency-Key');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).end();
      } else {
        res.status(403).end();
      }
      return;
    }
    next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      // P2-1: 动态允许商户已验证的自定义域名 + 平台主域
      const allowOrigins = frontendUrl.split(',').map((s) => s.trim());
      if (!origin) return callback(null, true); // 同源 / curl
      if (allowOrigins.includes(origin)) return callback(null, true);
      // 检查 DB 中已验证的自定义域名（异步查 + 缓存）
      // 简化：每次都查 DB（生产可加 Redis 缓存 5min）
      void prismaServiceForCors.shop
        .findFirst({
          where: { customDomain: new URL(origin).hostname, domainVerified: true },
          select: { id: true },
        })
        .then((shop) => {
          if (shop) callback(null, true);
          else callback(new Error(`CORS blocked: ${origin}`));
        })
        .catch(() => callback(new Error('CORS check failed')));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
  });

  // M2: Sentry 必须在 helmet 之前
  app.use(helmet());
  app.use(cookieParser());
  app.use(RequestIdMiddleware);

  // F1: SEO 静态化路由（在 NestJS 路由之前注册，绕过全局 prefix）
  // /shop/:code 返回 SSR HTML（含 SEO meta + JSON-LD），/sitemap.xml + /robots.txt
  // 前端 SPA 通过 location.href 接管正常访问，SEO 爬虫直接拿到 HTML
  const ssrService = app.get(SsrService);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/shop/:code', async (req: Request, res: Response) => {
    const code = req.params.code ?? '';
    const html = await ssrService.renderShopPage(code);
    if (html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.send(html);
    } else {
      res.status(404).type('text/html').send('<h1>店铺不存在</h1>');
    }
  });
  expressApp.get('/sitemap.xml', async (_req: Request, res: Response) => {
    const xml = await ssrService.renderSitemap();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  });
  expressApp.get('/robots.txt', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(ssrService.renderRobots());
  });
  // 商户自定义域名重写（必须在 json 解析前注册，因为它依赖原始 path）
  const prismaService = app.get(PrismaService);
  const shopHostMiddleware = new ShopHostMiddleware(prismaService);
  app.use((req: Request, res: Response, next: NextFunction) => shopHostMiddleware.use(req, res, next));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // M2: Sentry 错误处理必须在全局 filter 之前
  app.use(sentryErrorHandler);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Swagger 文档
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('WM Card API')
      .setDescription('WM 官方虚拟卡密交易平台 - API 文档')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'JWT')
      .addTag('auth', '鉴权')
      .addTag('shop', '买家侧 - 店铺/商品')
      .addTag('order', '买家侧 - 订单')
      .addTag('payment', '支付')
      .addTag('admin-products', '后台 - 商品')
      .addTag('admin-stock', '后台 - 卡密')
      .addTag('admin-orders', '后台 - 订单')
      .addTag('admin-payment-channels', '后台 - 支付通道')
      .addTag('admin-shops', '后台 - 店铺')
      .addTag('admin-audit-logs', '后台 - 审计日志')
      .addTag('admin-stats', '后台 - 统计')
      .addTag('admin-risk', '后台 - 风控')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${prefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'WM Card API 文档',
    });
    Logger.log(`📖 Swagger docs: http://localhost:${port}/${prefix}/docs`, 'Bootstrap');
  }

  // M3 优雅停机：启用 shutdown hooks
  app.enableShutdownHooks();

  // M3 优雅停机：监听 SIGTERM/SIGINT，先标 notReady，再等待进行中请求完成
  const SHUTDOWN_TIMEOUT_MS = 30_000;
  let isShuttingDown = false;
  const server = await app.listen(port);
  Logger.log(`🚀 API running on http://localhost:${port}/${prefix}`, 'Bootstrap');

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    Logger.warn(`收到 ${signal}，开始优雅停机（最多 ${SHUTDOWN_TIMEOUT_MS}ms）`, 'Bootstrap');
    const timer = setTimeout(() => {
      Logger.error('优雅停机超时，强制退出', 'Bootstrap');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    try {
      // 关闭 HTTP server（停止接受新连接，等待现有请求完成）
      server.close();
      // 关闭 NestJS 应用（清理资源、关闭 Prisma/Redis 连接）
      await app.close();
      clearTimeout(timer);
      Logger.log('优雅停机完成', 'Bootstrap');
      process.exit(0);
    } catch (err) {
      Logger.error(`优雅停机失败: ${(err as Error).message}`, 'Bootstrap');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrap();
