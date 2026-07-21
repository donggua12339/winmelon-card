/**
 * Cloudflare Worker: 微信支付 API 透明代理
 *
 * 用途：HK 服务器无法直连 api.mch.weixin.qq.com，通过 CF Worker 中转。
 * 部署：Cloudflare Dashboard → Workers → 创建 → 粘贴此代码 → 部署
 * 绑定自定义域名（可选）：如 wechat-proxy.yourdomain.com
 *
 * 安全说明：
 * - 仅转发到 api.mch.weixin.qq.com，不做任何修改
 * - 不记录请求体（含私钥签名），仅记录路径和状态码
 * - 可加 IP 白名单限制只允许你的 HK 服务器访问
 */

// 你的 HK 服务器 IP（可选白名单，留空则不限制）
const ALLOWED_IPS = ['162.251.93.199'];

const TARGET_HOST = 'api.mch.weixin.qq.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // IP 白名单检查（如果配置了的话）
    if (ALLOWED_IPS.length > 0) {
      const clientIP = request.headers.get('CF-Connecting-IP') || '';
      if (!ALLOWED_IPS.includes(clientIP)) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 健康检查
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', target: TARGET_HOST }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构造目标 URL
    const targetUrl = `https://${TARGET_HOST}${url.pathname}${url.search}`;

    // 透传 headers（去掉 Host 和 CF 特有的头）
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-IPCountry');
    headers.delete('CF-Ray');
    headers.delete('CF-Visitor');
    headers.delete('X-Forwarded-For');
    headers.delete('X-Forwarded-Proto');
    headers.delete('X-Real-IP');
    // 设置正确的 Host
    headers.set('Host', TARGET_HOST);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual',
      });

      // 透传响应 headers
      const respHeaders = new Headers(response.headers);
      // 加 CORS 头（虽然 API 调用不需要，但调试方便）
      respHeaders.set('Access-Control-Allow-Origin', '*');
      respHeaders.set('X-Proxy-By', 'cf-worker-wechat-proxy');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed', message: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }
  },
};
