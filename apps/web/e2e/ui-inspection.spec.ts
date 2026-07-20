import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT = path.join(import.meta.dirname, "ui-inspection");
for (const d of ["desktop", "tablet", "mobile", "flow"]) {
  fs.mkdirSync(path.join(OUT, d), { recursive: true });
}

interface Issue { type: string; severity: string; message: string; }

const SIZES = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
};

async function inspect(page, url, name, viewport = "desktop") {
  const issues = [];
  await page.setViewportSize(SIZES[viewport]);
  page.removeAllListeners("console");
  page.removeAllListeners("pageerror");
  page.removeAllListeners("response");
  page.on("console", (msg) => {
    if (msg.type() === "error") issues.push({ type: "console", severity: "med", message: msg.text().slice(0, 200) });
  });
  page.on("pageerror", (err) => {
    issues.push({ type: "pageerror", severity: "high", message: err.message.slice(0, 200) });
  });
  page.on("response", (resp) => {
    const status = resp.status();
    const u = resp.url();
    if (status >= 500) {
      issues.push({ type: "network", severity: "high", message: status + " " + u.slice(0, 120) });
    } else if (status >= 400 && !u.includes("/api/") && !u.includes("hm.baidu.com") && !u.includes("favicon") && !u.includes("google")) {
      issues.push({ type: "network", severity: "med", message: status + " " + u.slice(0, 120) });
    }
  });
  try {
    await page.goto("https://winmelon.cn" + url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    issues.push({ type: "pageerror", severity: "high", message: "Nav fail: " + e.message.slice(0, 150) });
  }
  const filename = viewport + "_" + name.replace(/\//g, "_") + ".png";
  try {
    await page.screenshot({ path: path.join(OUT, viewport, filename), fullPage: true, animations: "disabled" });
  } catch {}
  try {
    const html = await page.locator("html").getAttribute("lang").catch(() => null);
    if (!html) issues.push({ type: "a11y", severity: "med", message: "html missing lang" });
    const title = await page.title();
    if (!title) issues.push({ type: "a11y", severity: "low", message: "page title missing" });
    const h1 = await page.locator("h1, h2").count();
    if (h1 === 0) issues.push({ type: "a11y", severity: "low", message: "no h1/h2" });
    const imgsNoAlt = await page.locator("img:not([alt])").count();
    if (imgsNoAlt > 0) issues.push({ type: "a11y", severity: "low", message: imgsNoAlt + " img(s) missing alt" });
    const btnsNoName = await page.locator("button").evaluateAll((els) => els.filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label")).length);
    if (btnsNoName > 0) issues.push({ type: "a11y", severity: "med", message: btnsNoName + " button(s) no name" });
  } catch {}
  try {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    if (scrollWidth > viewportWidth + 5) {
      issues.push({ type: "visual", severity: "high", message: "h-scroll " + scrollWidth + ">" + viewportWidth });
    }
    const bodyText = await page.locator("body").textContent();
    if (bodyText && bodyText.trim().length < 50) {
      issues.push({ type: "visual", severity: "med", message: "body too short: " + bodyText.trim().length });
    }
  } catch {}
  return issues;
}

const PUBLIC_PAGES = [
  { name: "home", url: "/" },
  { name: "shop-main", url: "/shop/main" },
  { name: "query", url: "/query" },
  { name: "forgot-password", url: "/forgot-password" },
  { name: "activate", url: "/activate?token=test" },
  { name: "merchant-apply", url: "/merchant/apply" },
  { name: "mock-pay", url: "/payment/mock-pay?orderNo=test" },
  { name: "login", url: "/admin/login" },
  { name: "admin-dashboard", url: "/admin/dashboard" },
  { name: "admin-products", url: "/admin/products" },
  { name: "admin-finance", url: "/admin/finance/daily-report" },
  { name: "admin-cache", url: "/admin/cache/stats" },
];

for (const viewport of ["desktop", "mobile"]) {
  for (const p of PUBLIC_PAGES) {
    test(viewport + " - " + p.name + " (" + p.url + ")", async ({ page }) => {
      const issues = await inspect(page, p.url, p.name, viewport);
      if (issues.length > 0) {
        console.log("\n[" + viewport + " " + p.name + "] " + issues.length + " issues:");
        for (const i of issues) console.log("  [" + i.severity + "] " + i.type + ": " + i.message);
      } else {
        console.log("[" + viewport + " " + p.name + "] clean");
      }
    });
  }
}

test.describe("UI 交互流", () => {
  test("login + dashboard", async ({ page }) => {
    await page.setViewportSize(SIZES.desktop);
    await page.goto("https://winmelon.cn/admin/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "flow", "01-login-page.png"), fullPage: true });
    await page.fill('input[autocomplete="username"]', "admin");
    await page.fill('input[type="password"]', "Admin@2026!");
    await page.screenshot({ path: path.join(OUT, "flow", "02-login-filled.png"), fullPage: true });
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST", { timeout: 15000 }),
      page.keyboard.press("Enter"),
    ]);
    expect(resp.status()).toBe(200);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, "flow", "03-after-login.png"), fullPage: true });
    console.log("logged in, URL=" + page.url());
  });
  test("query form fill", async ({ page }) => {
    await page.setViewportSize(SIZES.desktop);
    await page.goto("https://winmelon.cn/query", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "flow", "04-query-page.png"), fullPage: true });
    const inputs = page.locator("input");
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.nth(0).fill("TEST123");
      await inputs.nth(1).fill("test@example.com");
      await page.screenshot({ path: path.join(OUT, "flow", "05-query-filled.png"), fullPage: true });
    }
  });
});
test("report dir", async () => {
  console.log("\nUI screenshots: " + OUT);
});
