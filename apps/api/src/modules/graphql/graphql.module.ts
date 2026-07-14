import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { MerchantResolver } from './resolvers/merchant.resolver';
import { ProductResolver } from './resolvers/product.resolver';
import { OrderResolver } from './resolvers/order.resolver';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'apps/api/src/schema.gql'),
      sortSchema: true,
      playground: true, // 启用 GraphQL Playground
      context: ({ req }: { req: Record<string, unknown> }) => ({ req }), // 透传 request 用于鉴权
    }),
  ],
  providers: [MerchantResolver, ProductResolver, OrderResolver],
  exports: [],
})
export class GqlModule {}
