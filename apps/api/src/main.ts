import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { ShopHostMiddleware } from './common/middlewares/shop-host.middleware';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import type { Request, Response, NextFunction } from 'express';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import type { NestApplication } from '@nestjs/core';
import { json, urlencoded } from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const prefix = config.get<string>('API_PREFIX', 'api');
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  const enableSwagger = config.get<string>('ENABLE_SWAGGER', 'true') !== 'false';

  app.setGlobalPrefix(prefix);

  app.enableCors({
    origin: frontendUrl.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
  });

  app.use(helmet());
  app.use(cookieParser());
  app.use(RequestIdMiddleware);
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

  await app.listen(port);
  Logger.log(`🚀 API running on http://localhost:${port}/${prefix}`, 'Bootstrap');
}

void bootstrap();
