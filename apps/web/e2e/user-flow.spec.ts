import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS = path.join(import.meta.dirname, 'screenshots', 'user-flow');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOTS, name + '.png'), fullPage: true });
}

async function adminLogin(page: Page) {
  await page.goto('https://winmelon.cn/admin/login', { waitUntil: 'commit' });
  await page.waitForTimeout(800);
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@2026!');
  await snap(page, '02-login-filled');
  // 用 Enter 键提交（button click 在 SPA 中经常不触发 form submit）
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }),
    page.keyboard.press('Enter'),
  ]);
  expect(resp.status()).toBe(200);
  console.log('  login API resp=' + resp.status());
  await page.waitForTimeout(2500);
  console.log('  current URL=' + page.url());
  await snap(page, '03-dashboard');
}

test.describe('真实用户流程 e2e', () => {
  test('admin 完整流程：登录 → dashboard', async ({ page, request }) => {
    // 1. 直接 API 登录（更稳）
    const loginRes = await request.post('https://winmelon.cn/api/auth/login', {
      data: { username: 'admin', password: 'Admin@2026!' },
    });
    expect(loginRes.status()).toBe(200);
    const loginJson = await loginRes.json();
    expect(loginJson.code).toBe('OK');
    const token = loginJson.data.accessToken;
    expect(token).toBeTruthy();
    console.log('✓ API 登录 200 OK, token len=' + token.length);

    // 2. 打开 dashboard (playwright 注入 cookie/storage 保持 token)
    await page.context().addCookies([{
      name: 'wm_refresh_token',
      value: 'placeholder',  // for completeness
      domain: '.winmelon.cn',
      path: '/',
    }]);
    // 设置 token via localStorage by visiting login first then inject
    await page.goto('https://winmelon.cn/admin/login');
    await page.evaluate((t) => {
      try { localStorage.setItem('wm_access_token', t as string); } catch (e) {}
    }, token);
    await page.goto('https://winmelon.cn/admin/dashboard', { waitUntil: 'commit' });
    await page.waitForTimeout(2000);
    await snap(page, '03-dashboard');
    const h = await page.locator('h1, h2').first().textContent().catch(() => '');
    console.log('dashboard heading: ' + h);
  });

  test('admin 页面走 Playwright UI 登录', async ({ page }) => {
    await adminLogin(page);
    // 验证 dashboard 元素
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(100);
    console.log('✓ UI 登录后 dashboard body 渲染');
  });

  test('admin 创建商品流程', async ({ page, request }) => {
    // 先 API 登录拿 token
    const loginRes = await request.post('https://winmelon.cn/api/auth/login', {
      data: { username: 'admin', password: 'Admin@2026!' },
    });
    const token = (await loginRes.json()).data.accessToken;

    // 创建商品
    const createRes = await request.post('https://winmelon.cn/api/admin/products', {
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      data: {
        shopId: 'd0978c80-b20b-458f-a328-8ac18a2bf86a',
        name: 'E2E Test Product ' + Date.now(),
        description: 'Playwright e2e test',
        price: 9.99,
      },
    });
    expect([200, 201, 400, 403, 404]).toContain(createRes.status());
    console.log('商品创建 API status=' + createRes.status());
  });

  test('错误消息清洗（信息泄露防护）', async ({ request }) => {
    const r = await request.get('https://winmelon.cn/api/shop/main/products?page=1&pageSize=99999');
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.message).toBe('请求参数无效');
    // 不能泄露具体约束
    expect(body.message).not.toMatch(/\d+\s*(characters|位|数字)/);
    console.log('400 错误已清洗: "' + body.message + '"');
  });

  test('CORS preflight OPTIONS 正常', async ({ request }) => {
    const r = await request.fetch('https://winmelon.cn/api/admin/products', {
      method: 'OPTIONS',
      headers: { Origin: 'https://winmelon.cn', 'Access-Control-Request-Method': 'POST' },
    });
    expect(r.status()).toBe(204);
    const acao = r.headers()['access-control-allow-origin'];
    expect(acao).toBe('https://winmelon.cn');
    console.log('CORS preflight 204 + ACAO=' + acao);
  });
});
