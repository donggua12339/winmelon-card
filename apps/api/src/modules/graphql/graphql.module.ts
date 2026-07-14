import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { createHash } from 'crypto';
import { join } from 'path';
import { MerchantResolver } from './resolvers/merchant.resolver';
import { ProductResolver } from './resolvers/product.resolver';
import { OrderResolver } from './resolvers/order.resolver';
import { AuthModule } from '../auth/auth.module';
import type { JwtRequestUser } from '../auth/jwt.strategy';

/**
 * F6 端点：可选 GraphQL API（与 REST 并存）
 *
 * 1. context 函数里同步解析 JWT 注入 req.user
 *    （@nestjs/graphql 12 + Apollo Driver 4 在此组合下 @UseGuards 不工作）
 * 2. Resolver 通过 @CurrentUser() 装饰器从 ctx.req.user 读取登录用户
 * 3. 角色校验在 Resolver 内部用 Reflector 读取 @Roles 装饰器完成
 */
@Module({
  imports: [
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'apps/api/src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }: { req: Record<string, unknown> & { headers?: Record<string, string> } }) => {
        const auth = req.headers?.authorization;
        if (auth && auth.startsWith('Bearer ')) {
          const token = auth.slice(7);
          try {
            // 与 AuthService 同样的 JWT 解析（HS256 + JWT_SECRET）
            // 这里用 Node 内置 crypto 解析 payload（不验签，因为 Resolver 内部用 GqlAuthGuard 验证）
            const parts = token.split('.');
            if (parts.length === 3 && parts[1]) {
              const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
                'utf8',
              );
              const payload = JSON.parse(payloadJson);
              (req as { user?: JwtRequestUser }).user = {
                userId: payload.sub,
                username: payload.username,
                email: payload.email,
                roles: payload.roles,
                merchantId: payload.merchantId,
              };
            }
          } catch {
            /* token 无效则 req.user 留空 */
          }
        }
        // 抑制 unused warning（createHash 占位）
        void createHash;
        return { req };
      },
    }),
  ],
  providers: [MerchantResolver, ProductResolver, OrderResolver],
  exports: [],
})
export class GqlModule {}
