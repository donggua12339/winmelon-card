import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { JwtRequestUser } from '../../auth/jwt.strategy';

/**
 * GraphQL @CurrentUser() 装饰器
 * 配合 GqlAuthGuard 使用，从 ctx.req.user 提取当前登录用户
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): JwtRequestUser => {
  const ctx = GqlExecutionContext.create(context);
  const { req } = ctx.getContext<{ req: { user: JwtRequestUser } }>();
  return req.user;
});
