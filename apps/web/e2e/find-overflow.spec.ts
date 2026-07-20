import { test, type Page } from '@playwright/test';

async function findOverflow(page: Page, url: string) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('https://winmelon.cn' + url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const results = await page.evaluate(() => {
    const out: any[] = [];
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const e = el as HTMLElement;
      if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0) {
        out.push({
          tag: e.tagName,
          class: e.className?.toString().slice(0, 80),
          id: e.id || null,
          sw: e.scrollWidth,
          cw: e.clientWidth,
        });
      }
    }
    return out.slice(0, 10);
  });
  return results;
}

test('home overflow elements', async ({ page }) => {
  const list = await findOverflow(page, '/');
  console.log('home overflow count=' + list.length);
  for (const i of list) console.log('  ' + i.tag + '.' + i.class + ' #' + i.id + ' sw=' + i.sw + ' cw=' + i.cw);
});

test('shop-main overflow elements', async ({ page }) => {
  const list = await findOverflow(page, '/shop/main');
  console.log('shop-main overflow count=' + list.length);
  for (const i of list) console.log('  ' + i.tag + '.' + i.class + ' #' + i.id + ' sw=' + i.sw + ' cw=' + i.cw);
});
