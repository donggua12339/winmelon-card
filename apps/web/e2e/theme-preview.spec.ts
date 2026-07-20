import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT = path.join(import.meta.dirname, 'theme-preview');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'home', url: '/' },
  { name: 'login', url: '/admin/login' },
  { name: 'shop-main', url: '/shop/main' },
  { name: 'forgot-password', url: '/forgot-password' },
];

test.describe('Stripe/Linear 主题预览', () => {
  for (const p of PAGES) {
    test(`亮色 - ${p.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('https://winmelon.cn' + p.url, { waitUntil: 'domcontentloaded' });
      // 确保亮色主题
      await page.evaluate(() => {
        localStorage.setItem('wm-theme', 'bright-business');
        document.documentElement.setAttribute('data-theme', 'bright-business');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `light-${p.name}.png`), fullPage: true });
    });

    test(`暗色 - ${p.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('https://winmelon.cn' + p.url, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('wm-theme', 'aurora-dark');
        document.documentElement.setAttribute('data-theme', 'aurora-dark');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `dark-${p.name}.png`), fullPage: true });
    });
  }
});
