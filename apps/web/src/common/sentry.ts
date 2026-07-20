import { init as initSentry, browserTracingIntegration, replayIntegration } from '@sentry/vue';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN_WEB;
const SENTRY_ENV = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || 'production';

/**
 * M2: 前端 Sentry 错误 + 性能监控
 * - DSN 未配置时不启用
 * - 路由切换 + 性能采样
 * - beforeSend: PII 脱敏
 */
export function initWebSentry(app: unknown): void {
  if (!SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.log('[Sentry] DSN 未配置，跳过初始化');
    return;
  }

  initSentry({
    app: app as never,
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    integrations: [browserTracingIntegration(), replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>;
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
          'token',
        ]) {
          if (key in data) delete data[key];
        }
      }
      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
          if (b.data && typeof b.data === 'object') {
            for (const k of ['password', 'token', 'authorization', 'cookie']) {
              if (k in b.data) (b.data as Record<string, unknown>)[k] = '[REDACTED]';
            }
          }
        }
      }
      return event;
    },
  });

  // eslint-disable-next-line no-console
  console.log('[Sentry web] initialized, env=' + SENTRY_ENV);
}
