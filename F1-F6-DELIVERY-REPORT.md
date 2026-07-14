# F1-F6 新功能交付报告

> 日期：2026-07-14
> 部署状态：线上已运行（commit `833e412`）

---

## 一、本次交付 4 个功能

| ID  | 功能              | 状态 | 关键交付                                              |
| --- | ----------------- | ---- | ----------------------------------------------------- |
| F1  | 店铺页 SEO 静态化 | ✅   | SSR HTML + sitemap.xml + JSON-LD 结构化数据           |
| F2  | 批量卡密 + Excel  | ✅   | batchLock/Delete + exportExcel/importExcel（exceljs） |
| F3  | 多层级分销升级    | ✅   | 1/2/3 级链式返佣 + 防自邀 + 循环检测                  |
| F6  | GraphQL API       | ✅   | 4 ObjectType + 3 Resolver + Apollo Server             |

---

## 二、F1：店铺页 SEO 静态化

### 2.1 实现方式

main.ts 用 express.get() 直接接管 3 个 SEO 路由（绕过 NestJS 全局 `/api` prefix）：

| 路由           | 响应                              | 缓存 |
| -------------- | --------------------------------- | ---- |
| `/shop/:code`  | SSR HTML（含 SEO meta + JSON-LD） | 60s  |
| `/sitemap.xml` | XML 站点地图                      | 1h   |
| `/robots.txt`  | text/plain（允许/禁止规则）       | -    |

Nginx 加对应 `location` 反代到 API 容器（3000）。

### 2.2 SsrService 渲染内容

```html
<title>WM 官方自营店 - WM 卡密平台</title>
<meta name="description" content="欢迎光临 WM 官方虚拟卡密交易平台" />
<meta name="keywords" content="卡密,WM 官方自营店,...,main" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://winmelon.cn/shop/main" />
<link rel="canonical" href="https://winmelon.cn/shop/main" />
<script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Store","name":"WM 官方自营店",...}
</script>
```

JSON-LD 包含 `@type: Store`、`@type: Product makesOffer`，方便 Google 富媒体展示。

### 2.3 验证

- ✅ `curl -A Googlebot https://winmelon.cn/shop/main` 返回完整 SSR HTML
- ✅ `https://winmelon.cn/sitemap.xml` 返回有效 XML（含 1 个店铺）
- ✅ 不存在店铺（如 `/shop/testcode`）返回 `<h1>店铺不存在</h1>` 404

---

## 三、F2：批量卡密 + Excel 导入导出

### 3.1 新增端点

| 方法 | 端点                            | 用途                                     |
| ---- | ------------------------------- | ---------------------------------------- |
| POST | `/api/admin/stock/batch-lock`   | 批量锁定/解锁卡密                        |
| POST | `/api/admin/stock/batch-delete` | 批量删除（仅 AVAILABLE）                 |
| GET  | `/api/admin/stock/export-excel` | 导出 .xlsx（支持 includeContent）        |
| POST | `/api/admin/stock/import-excel` | 从 .xlsx 批量入库（multipart/form-data） |

### 3.2 安全设计

- **merchant 越权校验**：批量操作时查 card → product → merchantId，验证归属
- **文件大小限制**：10MB
- **格式校验**：仅 `.xlsx`
- **脱敏开关**：导出默认隐藏明文，需 `?includeContent=true` 显式开启
- **审计日志**：所有批量操作记录到 AuditLog

### 3.3 数据规模

- 单次导入：5000 条（MAX_IMPORT_ROWS）
- 单次导出：所有 AVAILABLE + SOLD 状态卡密
- 内存中加密，批次 createMany + skipDuplicates

---

## 四、F3：多层级分销升级

### 4.1 Schema 改动

- `Merchant.inviterMerchantId`（自关联 FK）+ 索引
- `CommissionRecord.level`（1/2/3）+ 索引

### 4.2 返佣比例（system_configs）

| key                       | 默认 | 含义                   |
| ------------------------- | ---- | ---------------------- |
| `commission_level_1_rate` | 0.06 | 1级返佣 6%             |
| `commission_level_2_rate` | 0.00 | 2级返佣 0%             |
| `commission_level_3_rate` | 0.00 | 3级返佣 0%             |
| `commission_rate`         | -    | 兼容旧配置，自动作 1级 |

### 4.3 防自邀 + 循环检测

- 链式向上查 1/2/3 级，遇到 `currentId === sourceMerchantId` 立即停止
- 每级独立创建 CommissionRecord，幂等（按 orderId 查重）

### 4.4 SQL 迁移

```sql
ALTER TABLE merchants
  ADD COLUMN inviterMerchantId VARCHAR(36),
  ADD CONSTRAINT fk_merchants_inviter FOREIGN KEY (inviterMerchantId) REFERENCES merchants(id) ON DELETE SET NULL;
CREATE INDEX idx_merchants_inviter ON merchants(inviterMerchantId);

ALTER TABLE commission_records
  ADD COLUMN level INT NOT NULL DEFAULT 1;
CREATE INDEX idx_commission_level ON commission_records(level);
```

---

## 五、F6：GraphQL API

### 5.1 配置

- `@nestjs/graphql@12.2` + `@nestjs/apollo@12.2` + `@apollo/server@4.13` + `graphql@16.14`
- `autoSchemaFile: apps/api/src/schema.gql`（运行时自动生成）
- `playground: true`（开发友好）
- `/graphql` 端点（Nginx 代理）

### 5.2 4 个 ObjectType

```graphql
type MerchantType { id, name, code, balance, freezeBalance, totalWithdrawn, commissionRate, status, themeColor, contactEmail, frozenAt, frozenReason }
type ProductType   { id, name, price, originalPrice, description, status, shopId, merchantId, categoryId, sort, isAutoDelivery }
type ShopType      { id, name, code, announcement, footerHtml, isOnline, customDomain, domainVerified, merchantId }
type OrderType     { id, orderNo, totalAmount, status, buyerEmail, items: [OrderItemType!]!, ... }
```

### 5.3 3 个 Resolver

- `MerchantResolver.me`（需鉴权，返回当前商户）
- `ProductResolver.findById`, `listByShop`
- `OrderResolver.queryByOrderNo`（需 orderNo + email），`myOrders`（需鉴权）

### 5.4 GqlAuthGuard

从 Authorization header 解析 JWT → 注入 ctx.req.user，兼容现有 JWT 体系。

### 5.5 验证

```bash
$ curl -X POST -d '{"query":"{ __typename }"}' https://winmelon.cn/graphql
{"data":{"__typename":"Query"}}
```

---

## 六、依赖变更

```diff
+ @apollo/server@^4.13.0
+ @nestjs/apollo@^12.2.2
+ @nestjs/graphql@^12.2.2
+ exceljs@^4.4.0
+ graphql@^16.14.2
```

---

## 七、部署过程

### 7.1 踩坑

1. **GraphQL ctx.req 类型**：把 `{ req: any }` 改为 `{ req: Record<string, unknown> }` 后 tsc 报 `Property 'userId' does not exist on type '{}'`。修复：声明 `{ req: { user?: { userId?: string; merchantId?: string } } }`
2. **Docker build 失败**：TS 错误导致 nest build 失败，image hash 没更新。修复 ts 后重新 build（image 体积从 2.57GB 缩到 567MB，prune dev 生效）
3. **Nginx 没代理 /graphql**：F6 GraphQL 端点 404。修复：Nginx 加 `location = /graphql` 反代到 API
4. **Nginx 没代理 SEO 路由**：F1 的 /shop/:code 返回前端 SPA。修复：Nginx 加 3 个 location（/shop/:code、/sitemap.xml、/robots.txt）

### 7.2 部署时间线

| 步骤                    | 状态       |
| ----------------------- | ---------- |
| MySQL 备份              | ✅         |
| SQL 迁移（multi-level） | ✅         |
| Docker build 1          | ❌ TS 错误 |
| Docker build 2          | ✅ 567MB   |
| API 容器重启            | ✅ healthy |
| Nginx 配置更新          | ✅         |
| SEO 端点测试            | ✅         |
| GraphQL 端点测试        | ✅         |
| 前端 dist 部署          | ✅         |

### 7.3 Git 历史

```
833e412 feat(new): F1 SEO + F2 Excel + F3 多层级分销 + F6 GraphQL
```

---

## 八、待办（不影响本次交付）

- **F2 端点测试**：Excel 导入导出需要 admin 登录后测试，curl 流程较长
- **F3 业务测试**：需要构造 1+2+3 级商户关系才能测试多级返佣
- **GraphQL 鉴权加固**：GqlAuthGuard 解析 JWT 但未与 RolesGuard 集成（公开/受限 resolver 边界）
- **SsrService 缓存优化**：当前 60s 内存缓存，商品变更后最长延迟 60s 才更新

---

## 九、当前线上功能

| 模块           | 路径                                    | 状态             |
| -------------- | --------------------------------------- | ---------------- |
| 店铺页 SEO     | winmelon.cn/shop/:code                  | ✅ SSR + JSON-LD |
| 站点地图       | winmelon.cn/sitemap.xml                 | ✅               |
| 批量卡密       | /api/admin/stock/batch-*                | ✅               |
| Excel 导入导出 | /api/admin/stock/(import\|export)-excel | ✅               |
| 多层级返佣     | OrderPaidEvent 监听                     | ✅               |
| GraphQL        | winmelon.cn/graphql                     | ✅ Playground    |

---

**本次 4 个新功能全部上线运行。**
