import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

const SENTRY_DSN = process.env.SENTRY_DSN_API;

/**
 * M2: 初始化 Sentry 错误 + 性能监控（v8+ API）
 * - DSN 未配置时不启用
 * - httpIntegration: 自动追踪每个 HTTP 请求
 * - expressIntegration: 自动捕获 Express 错误
 * - beforeSend: PII 脱敏
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.log('[Sentry] DSN 未配置，跳过初始化');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || 'unknown',
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    sendDefaultPii: false,
    integrations: [
      // HTTP 请求自动追踪（替代 v7 的 requestHandler + tracingHandler）
      Sentry.httpIntegration(),
      // Express 错误自动捕获
      Sentry.expressIntegration(),
    ],
    // @ts-expect-error Sentry 类型复杂
    beforeSend: (event: unknown) => {
      const e = event as {
        user?: { email?: string; ip_address?: string; username?: string } | null;
        request?: { data?: Record<string, unknown> } | null;
        breadcrumbs?: Array<{ data?: unknown }>;
      };
      if (e.user) {
        delete e.user.email;
        delete e.user.ip_address;
        delete e.user.username;
      }
      if (e.request?.data) {
        for (const key of [
          'password',
          'oldPassword',
          'newPassword',
          'confirmPassword',
          'card',
          'cards',
          'cardContent',
          'phone',
          'mobile',
          'idCard',
          'bankAccount',
        ]) {
          if (key in e.request.data) delete e.request.data[key];
        }
      }
      if (e.breadcrumbs) {
        for (const b of e.breadcrumbs) {
          if (b.data && typeof b.data === 'object') {
            for (const k of ['password', 'token', 'authorization', 'cookie', 'set-cookie']) {
              if (k in (b.data as Record<string, unknown>)) (b.data as Record<string, unknown>)[k] = '[REDACTED]';
            }
          }
        }
      }
      return e;
    },
  });

  // eslint-disable-next-line no-console
  console.log('[Sentry] initialized, env=' + (process.env.NODE_ENV || 'development'));
}

/**
 * M2: Sentry Express 错误处理（v8+ 新 API）
 * 作为 Express error middleware 使用：app.use(sentryErrorHandler)
 */
export const sentryErrorHandler: (err: unknown, req: Request, res: Response, next: NextFunction) => void = (
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  Sentry.captureException(err);
  next(err);
};
