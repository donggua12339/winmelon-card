import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('ConfigValidator');

/**
 * 启动期密钥校验
 * 任何缺失或不合规的密钥直接 throw，让容器启动失败暴露问题
 * 必须在 NestApplication 完全启动前调用
 */
export function validateCriticalConfig(config: ConfigService): void {
  const checks: Array<{ key: string; minLen?: number; required: boolean }> = [
    { key: 'JWT_SECRET', minLen: 32, required: true },
    { key: 'JWT_REFRESH_SECRET', minLen: 32, required: true },
    { key: 'CARD_ENCRYPTION_KEY', required: true },
    { key: 'MYSQL_PASSWORD', required: true },
    { key: 'REDIS_PASSWORD', required: true },
    { key: 'DATABASE_URL', required: true },
    { key: 'REDIS_URL', required: true },
    // P0-3 v2: 专用 visitorId salt，与 JWT_SECRET 解耦
    { key: 'VISITOR_SALT', minLen: 16, required: true },
    // P1-6: refresh token 改 httpOnly cookie
    { key: 'COOKIE_DOMAIN', required: true },
  ];

  const errors: string[] = [];

  for (const c of checks) {
    const val = config.get<string>(c.key);
    if (!val || val.trim().length === 0) {
      if (c.required) errors.push(`  - ${c.key}: 未配置`);
      continue;
    }
    if (c.minLen && val.length < c.minLen) {
      errors.push(`  - ${c.key}: 长度必须 ≥ ${c.minLen}（当前 ${val.length}）`);
    }
    if (val.includes('CHANGE_ME')) {
      errors.push(`  - ${c.key}: 仍是模板默认值 CHANGE_ME_*，请生成真实密钥`);
    }
  }

  // JWT_SECRET 与 JWT_REFRESH_SECRET 不能相同
  const jwtSecret = config.get<string>('JWT_SECRET');
  const jwtRefreshSecret = config.get<string>('JWT_REFRESH_SECRET');
  if (jwtSecret && jwtRefreshSecret && jwtSecret === jwtRefreshSecret) {
    errors.push('  - JWT_SECRET 与 JWT_REFRESH_SECRET 不能相同');
  }

  // P1-6: COOKIE_SAMESITE 必须是 lax/strict/none
  const cookieSameSite = (config.get<string>('COOKIE_SAMESITE') ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
    errors.push(`  - COOKIE_SAMESITE 必须是 lax/strict/none，当前 ${cookieSameSite}`);
  }

  // MAIL 交叉校验：MAIL_USER 和 MAIL_PASS 必须成对（同设同缺）
  // 设了 user 就要 pass（反之亦然），否则邮件要么发不出去要么送到无人邮箱
  const mailUser = config.get<string>('MAIL_USER');
  const mailPass = config.get<string>('MAIL_PASS');
  if ((mailUser && !mailPass) || (!mailUser && mailPass)) {
    errors.push('  - MAIL_USER 和 MAIL_PASS 必须同时设置（要么都不配邮件禁用，要么都配启用 SMTP）');
  }
  // 如果配了，校验基本格式（避免上线后才发现邮箱无效）
  if (mailUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailUser)) {
    errors.push(`  - MAIL_USER 格式不像邮箱：${mailUser}`);
  }
  if (mailPass && mailPass.length < 8) {
    errors.push(`  - MAIL_PASS 长度过短（当前 ${mailPass.length}，至少 8 位，可能是 QQ 授权码格式错误）`);
  }
  const mailPortRaw = config.get<string>('MAIL_PORT');
  if (mailPortRaw !== undefined && mailPortRaw !== '') {
    const port = Number(mailPortRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push(`  - MAIL_PORT 必须是 1-65535 整数，当前 ${mailPortRaw}`);
    }
  }
  // COOKIE_SECURE 必须 true（生产 HTTPS）
  const cookieSecureRaw = config.get<string>('COOKIE_SECURE');
  if (cookieSecureRaw !== undefined && cookieSecureRaw !== '' && cookieSecureRaw !== 'true') {
    errors.push(`  - COOKIE_SECURE 必须为 true（生产用 HTTPS），当前 ${cookieSecureRaw}`);
  }

  if (errors.length > 0) {
    logger.error('启动配置校验失败：');
    errors.forEach((e) => logger.error(e));
    logger.error('请检查 .env / .env.prod 文件，参考 .env.example 生成密钥');
    throw new Error(`配置校验失败：\n${errors.join('\n')}`);
  }

  logger.log(`✓ 关键配置校验通过（${checks.length} 项）`);
}
