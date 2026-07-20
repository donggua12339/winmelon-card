import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = path.join(import.meta.dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function auditPage(page, url, name) {
  const result = { url, consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.removeAllListeners('response');
  page.on('console', (msg) => { if (msg.type() === 'error') result.consoleErrors.push(msg.text().slice(0, 200)); });
  page.on('pageerror', (err) => result.pageErrors.push(err.message.slice(0, 200)));
  page.on('response', (resp) => { if (resp.status() >= 400) result.failedRequests.push({ url: resp.url(), status: resp.status() }); });
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 8000 });
    await page.waitForTimeout(1500);
  } catch (e) {
    result.pageErrors.push('Nav fail: ' + e.message.slice(0, 150));
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, name + '.png'), fullPage: true });
  return result;
}

const pages = [
  { name: 'home', url: '/' },
  { name: 'login', url: '/admin/login' },
  { name: 'forgot-password', url: '/forgot-password' },
  { name: 'activate', url: '/activate?token=test' },
  { name: 'query-order', url: '/query' },
  { name: 'shop-main', url: '/shop/main' },
  { name: 'merchant-apply', url: '/merchant/apply' },
  { name: 'mock-pay', url: '/payment/mock-pay?orderNo=test' },
  { name: 'admin-dashboard', url: '/admin/dashboard' },
];

for (const p of pages) {
  test('scan ' + p.name, async ({ page }) => {
    const r = await auditPage(page, p.url, p.name);
    const all = [...r.consoleErrors, ...r.pageErrors, ...r.failedRequests];
    console.log('[' + p.name + '] ' + r.url + ' -> ' + all.length + ' issues');
    for (const e of all) console.log('  - ' + e);
  });
}

test('summary', async () => {
  console.log('\nScreenshots: ' + SCREENSHOTS_DIR);
});
