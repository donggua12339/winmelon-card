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

  if (errors.length > 0) {
    logger.error('启动配置校验失败：');
    errors.forEach((e) => logger.error(e));
    logger.error('请检查 .env / .env.prod 文件，参考 .env.example 生成密钥');
    throw new Error(`配置校验失败：\n${errors.join('\n')}`);
  }

  logger.log(`✓ 关键配置校验通过（${checks.length} 项）`);
}
