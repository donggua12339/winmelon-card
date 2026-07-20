# E2E 测试 (Playwright)

## 跑测试

```bash
# 1. 装浏览器 (一次性)
npx playwright install chromium --with-deps

# 2. 跑所有 e2e
npx playwright test

# 3. 跑单个 spec
npx playwright test e2e/ui-audit.spec.ts --reporter=list
```

## 测试列表

- `ui-audit.spec.ts` - 9 个关键页面扫描 console.error / pageerror / 4xx 5xx
- `user-flow.spec.ts` - 真实用户流程: 登录、商品、错误清洗、CORS
- `visual-regression.spec.ts` - 视觉回归 baseline 对比

## 截图位置

- `screenshots/ui-audit/` - 9 张全页截图 (每次跑覆盖)
- `screenshots/user-flow/` - 用户流程截图
- `screenshots/visual-baseline/` - 第一次跑生成 baseline
- `screenshots/visual/` - 后续跑生成对比图

## 在 CI 里跑

GitHub Actions workflow: `.github/workflows/ci.yml`
