import { createHash } from 'crypto';

/**
 * visitorId 计算（PageView 与 Order 共用）
 * - 算法：sha256(ip + '|' + ua + '|' + salt) 前 16 字符
 * - 不存原始 IP，visitorId 不可被外部反推
 */
export function computeVisitorId(ip: string, ua: string, salt: string): string {
  return createHash('sha256').update(`${ip}|${ua}|${salt}`, 'utf8').digest('hex').slice(0, 16);
}

/**
 * P0-3 v2: Bot UA 黑名单（爬虫 + 工具）
 * - 顺序敏感：长前缀在前（避免短前缀误匹配）
 * - 匹配方式：UA 字符串大小写不敏感包含任一 pattern 即判定为 bot
 */
export const BOT_UA_PATTERNS: readonly string[] = [
  // 搜索引擎爬虫
  'Googlebot',
  'Bingbot',
  'Slurp',
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'Sogou',
  'Exabot',
  'facebot',
  'ia_archiver',
  // 第三方爬虫
  'AhrefsBot',
  'SemrushBot',
  'DotBot',
  'MJ12bot',
  'PetalBot',
  // 命令行工具
  'curl/',
  'Wget/',
  'python-requests',
  'python-urllib',
  'Go-http-client',
  'Java/',
  'libwww-perl',
  // API 调试工具
  'PostmanRuntime',
  'Insomnia',
  'httpie',
  // 无头浏览器
  'HeadlessChrome',
  'PhantomJS',
  'puppeteer',
  'selenium',
  'webdriver',
] as const;

/** 是否判定为 bot UA（大小写不敏感） */
export function isBotUa(ua: string | undefined | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}
