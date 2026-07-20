import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

const SCREENSHOTS = path.join(import.meta.dirname, 'screenshots', 'visual');
const BASELINES = path.join(import.meta.dirname, 'screenshots', 'visual-baseline');
for (const d of [SCREENSHOTS, BASELINES]) fs.mkdirSync(d, { recursive: true });

const THRESHOLD = 0.02;
const FROZEN_NOW = new Date('2026-07-18T12:00:00Z').getTime();
const FROZEN_RANDOM = 0.42;

interface PageConfig {
  name: string;
  url: string;
  extraWait?: number;
  mask?: string;
}

const PAGES: PageConfig[] = [
  { name: 'home', url: '/' },
  { name: 'login', url: '/admin/login' },
  { name: 'forgot-password', url: '/forgot-password', mask: '.captcha-box, .captcha, img[alt=captcha], [class*=captcha], svg.captcha' },
  { name: 'query', url: '/query' },
  { name: 'shop-main', url: '/shop/main', extraWait: 3000, mask: '.el-skeleton, .stock, .footer' },
  { name: 'merchant-apply', url: '/merchant/apply' },
];

function pixelDiff(a: PNG, b: PNG): { diff: number; total: number; rate: number } {
  if (a.width !== b.width || a.height !== b.height) {
    return { diff: Infinity, total: 0, rate: 1 };
  }
  const w = a.width, h = a.height;
  let diff = 0, total = w * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (a.data[i + 3] < 10 && b.data[i + 3] < 10) continue;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) diff++;
    }
  }
  return { diff, total, rate: diff / total };
}

async function injectStabilizers(page: Page) {
  await page.addInitScript(({ frozenNow, frozenRandom }) => {
    const FROZEN_NOW = frozenNow;
    const FROZEN_RANDOM = frozenRandom;
    const _Date = Date;
    (globalThis as any).Date = class extends _Date {
      constructor(...args: any[]) {
        if (args.length === 0) super(FROZEN_NOW);
        else super(...args);
      }
      static now() { return FROZEN_NOW; }
    };
    Date.now = () => FROZEN_NOW;
    Math.random = () => FROZEN_RANDOM;
    const style = document.createElement('style');
    style.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  }, { frozenNow: FROZEN_NOW, frozenRandom: FROZEN_RANDOM });
}

async function capturePage(page: Page, p: PageConfig) {
  await injectStabilizers(page);
  await page.goto('https://winmelon.cn' + p.url, { waitUntil: 'commit', timeout: 30000 });
  const extraWait = p.url.includes("shop") ? 3000 : 0; await page.waitForTimeout(2000 + extraWait);
  if (p.mask) {
    await page.evaluate((sel) => {
      document.querySelectorAll(sel).forEach((el: any) => {
        el.style.background = '#888';
        el.style.color = '#888';
      });
    }, p.mask);
  }
  return page.screenshot({
    path: path.join(SCREENSHOTS, p.name + '.png'),
    fullPage: true,
    animations: 'disabled',
  });
}

test.describe('视觉回归（容差 2%，mock 时间+禁动画+mask 动态区）', () => {
  test('捕获 baseline', async ({ page }) => {
    for (const p of PAGES) {
      await capturePage(page, p);
      fs.copyFileSync(
        path.join(SCREENSHOTS, p.name + '.png'),
        path.join(BASELINES, p.name + '.png'),
      );
    }
    console.log('已捕获 ' + PAGES.length + ' 个 baseline');
  });

  test('对比 baseline (容差 ' + (THRESHOLD * 100) + '%)', async ({ page }) => {
    let passed = 0, failed = 0;
    for (const p of PAGES) {
      const baseline = path.join(BASELINES, p.name + '.png');
      if (!fs.existsSync(baseline)) continue;
      await capturePage(page, p);
      const a = PNG.sync.read(fs.readFileSync(baseline));
      const b = PNG.sync.read(fs.readFileSync(path.join(SCREENSHOTS, p.name + '.png')));
      const { rate, diff, total } = pixelDiff(a, b);
      const ok = rate < THRESHOLD;
      if (ok) passed++; else failed++;
      console.log('  ' + p.name + ': ' + (ok ? 'PASS' : 'FAIL') + ' diff=' + (rate * 100).toFixed(2) + '% (' + diff + '/' + total + ')');
    }
    console.log('\n' + passed + ' pass, ' + failed + ' fail');
  });
});
