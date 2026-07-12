import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { IdModule } from './infrastructure/id/id.module';
import { MailModule } from './infrastructure/mail/mail.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { ProductModule } from './modules/product/product.module';
import { StockModule } from './modules/stock/stock.module';
import { ShopModule } from './modules/shop/shop.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { StatsModule } from './modules/stats/stats.module';
import { RiskModule } from './modules/risk/risk.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { ThrottleInterceptor } from './common/interceptors/throttle.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    PrismaModule,
    RedisModule,
    CryptoModule,
    IdModule,
    MailModule,
    AuditLogModule,
    AuthModule,
    ProductModule,
    StockModule,
    ShopModule,
    OrderModule,
    PaymentModule,
    DeliveryModule,
    StatsModule,
    RiskModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ThrottleInterceptor,
    },
  ],
})
export class AppModule {}
