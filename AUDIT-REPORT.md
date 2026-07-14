# WM 发卡网 - 代码审计报告

> 审计日期：2026-07-14
> 审计范围：apps/api/src（NestJS 后端）+ apps/web/src（Vue3 前端）+ prisma schema + Docker 部署
> 审计人：全栈开发工程师（Claude Code 接管维护）

---

## 0. 总体评价

项目整体工程质量**中等偏上**：

- 模块化清晰，关注点分离良好
- 关键安全机制齐备：JWT + Refresh Token 旋转、bcrypt(12)、AES-256-GCM 卡密加密、风控黑名单、审计日志、限流
- 事务使用合理：下单、发卡、提现、回调都用了 `$transaction`
- 条件更新防并发：`updateMany where status=...` 防止重复处理

但存在**多个高危问题**和**大量中危问题**，主要集中在：

1. 异常类型混用（throw `Error` 而非 NestJS Exception）导致 500 错误
2. 敏感数据明文存储（API Key、支付通道配置）
3. 密码学随机数误用（`Math.random()` 生成验证码/密码）
4. XSS 风险（footerHtml、卡密内容直插 HTML）
5. Docker 镜像包含 dev 依赖
6. 路由守卫与角色边界不严密

**没有发现后门、恶意代码或明显的供应链接入风险。**

---

## 1. 漏洞清单（按严重度排序）

### 🔴 P0 - 高危（必须立即修复）

#### P0-1. JWT_SECRET 未配置时静默使用 undefined

**文件**：`apps/api/src/modules/auth/auth.module.ts:19-22`

```typescript
useFactory: (config: ConfigService) => ({
  secret: config.get<string>('JWT_SECRET'),  // undefined 时不会报错
  signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
}),
```

**风险**：若 `.env` 缺失 `JWT_SECRET`，`jwt.sign` 用 `undefined` 作为 secret，攻击者可轻易伪造任意用户的 token（包括 SUPER_ADMIN）。
**修复方案**：在 `useFactory` 中加入启动校验：

```typescript
const secret = config.get<string>('JWT_SECRET');
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 chars');
}
```

同样需要校验 `JWT_REFRESH_SECRET`、`CARD_ENCRYPTION_KEY`、`MYSQL_PASSWORD`、`REDIS_PASSWORD`。

---

#### P0-2. API Key 明文存储

**文件**：`apps/api/src/modules/open-api/api-key.service.ts:58-68, 121-130`

```typescript
// 创建时直接存明文
await this.prisma.apiKey.create({ data: { key: fullKey, ... } });

// 验证时直接 findUnique 明文
const apiKey = await this.prisma.apiKey.findUnique({ where: { key: rawKey } });
```

**风险**：数据库泄露 = 所有商户 API Key 泄露，攻击者可代商户创建商品、导入卡密、查看订单。
**修复方案**：

- 存储 `keyHash = sha256(fullKey)`，`keyHint = sk_live_...xxxx` 用于展示
- 验证时 `findUnique({ where: { keyHash: sha256(rawKey) } })`
- 完整 key 仅在创建时返回一次

---

#### P0-3. 支付通道配置明文存储

**文件**：`apps/api/src/modules/payment/payment.service.ts:352-364` + `prisma/schema.prisma:313`

```typescript
private decryptConfig(encrypted: string): Record<string, unknown> {
  try {
    // config 存储格式：JSON 字符串。MVP 阶段先不加密，直接 JSON.parse
    return JSON.parse(encrypted);
  } catch {
    return {};
  }
}
```

schema 注释甚至写着 "加密存储配置（密钥等）"，但实际是明文 JSON。
**风险**：EPAY_KEY、支付宝私钥、微信 API V3 Key 等密钥明文存 DB，DB 泄露即全部泄露。
**修复方案**：用已有的 `AesGcmService` 加密配置 JSON：

```typescript
private decryptConfig(encrypted: string): Record<string, unknown> {
  const json = this.aes.decrypt(JSON.parse(encrypted));  // {ciphertext, iv, tag}
  return JSON.parse(json);
}
```

需要新增一个 `PAYMENT_CONFIG_ENCRYPTION_KEY` 或复用 `CARD_ENCRYPTION_KEY`。

---

#### P0-4. throw `Error` 而非 NestJS Exception（多处）

**文件清单**：

- `apps/api/src/modules/auth/password-reset.controller.ts:67` `throw new Error('图形验证码错误或已过期')`
- `apps/api/src/modules/withdrawal/withdrawal.controller.ts:48, 57, 74` `throw new Error('no-merchant')`
- `apps/api/src/modules/product/product.controller.ts:118` `throw new Error('当前账号未绑定商户...')`
- `apps/api/src/modules/product/product.controller.ts:58` `return { error: 'no-merchant' }` (200 状态码)
- `apps/api/src/modules/shop/admin-shop.controller.ts:62` `throw new Error('当前用户未关联商户')`
- `apps/api/src/modules/delivery/delivery.service.ts:60, 62, 65, 110, 126` `throw new Error(...)`
- `apps/api/src/modules/payment/payment.service.ts:161, 169, 174` `throw new Error(...)`
- `apps/api/src/modules/payment/usdt.service.ts:165` `throw new Error('未找到 USDT 支付记录')`

**风险**：`Error` 不被 NestJS 序列化器识别，会被 `AllExceptionsFilter` 当作 `INTERNAL_SERVER_ERROR` (500) 处理，前端看到"服务器内部错误"。实际是 400/403 业务逻辑错误。
**修复方案**：替换为对应的 NestJS 异常：

- `throw new Error('no-merchant')` → `throw new ForbiddenException('当前账号未绑定商户')`
- `throw new Error('图形验证码错误或已过期')` → `throw new BadRequestException(...)`
- `throw new Error('订单不存在')` → `throw new NotFoundException(...)`

---

#### P0-5. `Math.random()` 生成密码学敏感随机数

**文件**：

- `apps/api/src/modules/auth/password-reset.service.ts:72` 6 位邮箱验证码
- `apps/api/src/modules/auth/password-reset.service.ts:241` 4 位图形验证码
- `apps/api/src/modules/merchant-application/merchant-application.service.ts:283-289` 商户初始密码

```typescript
const code = Math.floor(100000 + Math.random() * 900000).toString();
```

**风险**：`Math.random()` 不是 CSPRNG，V8 实现基于 xorshift128+，理论上可预测。攻击者观察足够多次输出可还原内部状态，进而预测下一个验证码/密码。
**修复方案**：用 `crypto.randomInt()`：

```typescript
import { randomInt } from 'crypto';
const code = randomInt(100000, 1000000).toString();
```

---

#### P0-6. 邮件 HTML 注入 / 卡密内容 XSS

**文件**：

- `apps/api/src/infrastructure/mail/mail.service.ts:88` 卡密内容直接插入 HTML
- `apps/api/src/infrastructure/mail/mail.service.ts:265` 商户初始密码插入 HTML
- `apps/api/src/modules/shop/shop.service.ts:166` + `admin-shop.controller.ts:34-57` `footerHtml` 字段允许商户自定义 HTML

```typescript
<code ...>${c.content}</code>  // 卡密内容未 escape
```

**风险**：

- 卡密内容是商户上传的，若包含 `<script>...</script>` 等标签，虽然邮件客户端大多禁用 JS，但订单查询页面（前端 Vue 用 `v-html`）会执行
- `footerHtml` 商户可注入任意 JS，可窃取买家邮箱、改支付地址、注入挖矿脚本
  **修复方案**：

1. 卡密内容用 `textContent` 而非 `innerHTML`；HTML 中用 `<pre>` + 实体编码
2. `footerHtml` 引入 `sanitize-html` 白名单过滤（仅允许 `<p>`、`<a>`、`<img>`、`<strong>` 等安全标签）

---

#### P0-7. Docker 生产镜像包含 dev 依赖

**文件**：`deploy/docker/api.Dockerfile:21, 55`

```dockerfile
ENV NODE_ENV=development
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps --ignore-scripts
# ...
COPY --from=builder /app/node_modules ./node_modules  # 包含所有 dev 依赖
```

**风险**：生产镜像包含 typescript、jest、eslint、@types/* 等，攻击面增大；镜像体积膨胀 2-3 倍。
**修复方案**：在 builder stage 末尾或 runner stage 单独执行：

```dockerfile
# Stage 2.5: prune dev deps
RUN npm prune --omit=dev
```

或在 stage 2 重新 `npm ci --omit=dev`。

---

### 🟠 P1 - 中危（尽快修复）

#### P1-1. 修改密码后未吊销 refresh token

**文件**：`apps/api/src/modules/auth/auth.service.ts:124-170`

```typescript
async changePassword(...) {
  // ...
  // 吊销所有 refresh token（强制重新登录）
  // 注意：这里简单粗暴，扫描所有 refresh:${userId} 的 key 难度大
  // 实际生产可以用 Redis Hash + 用户ID 索引
  // 简化处理：仅记录审计 + 提示前端提示重新登录
  // ❌ 实际没做任何吊销
}
```

**风险**：账号被盗后用户改密，但攻击者持有的旧 refresh token 仍可刷新 access token 7 天。
**修复方案**：

- 在 User 表加 `tokenEpoch: Int @default(0)` 字段
- `issueTokens` 时把 epoch 写入 JWT payload
- `refresh` 时校验 epoch 一致
- `changePassword` 时 `increment tokenEpoch`

---

#### P1-2. ThrottleInterceptor 信任 X-Forwarded-For

**文件**：`apps/api/src/common/interceptors/throttle.interceptor.ts:41`

```typescript
const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
```

**风险**：若 Nginx 没正确配置 `proxy_set_header X-Real-IP $remote_addr`，或攻击者直接访问 API（绕过 Nginx），可伪造 X-Forwarded-For 绕过限流。
**修复方案**：

- 在 NestJS 启动时设置 `app.set('trust proxy', 'loopback, 162.251.93.5')` 仅信任已知代理
- 或从 `req.socket.remoteAddress` 取真实 IP，仅当确认来自代理时才用 XFF

---

#### P1-3. 限流 key 含完整路径而非路由模板

**文件**：`apps/api/src/common/interceptors/throttle.interceptor.ts:42-43`

```typescript
const route = `${req.method}:${req.path}`; // /api/orders/123 和 /api/orders/456 是不同 key
const key = `throttle:${opts.keySuffix ?? route}:${ip}`;
```

**风险**：RESTful 路径参数让限流形同虚设。攻击者轮询不同 orderNo 可绕过 `/orders/query` 的限流。
**修复方案**：用 NestJS 的路由模板：

```typescript
const route = `${req.method}:${req.route?.path ?? req.path}`;
```

或用 `Reflector` 在装饰器上声明 throttle key。

---

#### P1-4. Open API scope 检查形同虚设

**文件**：`apps/api/src/modules/open-api/open-api.controller.ts` 全文

```typescript
@Post('products')  // 没有 @RequireApiKey('write')
async createProduct(...) { ... }

@Post('stock/import')  // 没有 @RequireApiKey('write')
async importStock(...) { ... }
```

**风险**：商户创建 read-only API Key 后，该 key 仍可调用所有写接口（创建商品、导入卡密），违反最小权限原则。
**修复方案**：在所有写接口上加 `@RequireApiKey('write')`，读接口加 `@RequireApiKey('read')`。

---

#### P1-5. merchantId 唯一约束导致无法添加 STAFF

**文件**：`prisma/schema.prisma:34`

```prisma
model User {
  merchantId   String?        @unique  // ❌ 一个商户只能有一个用户
  merchant     Merchant?      @relation(fields: [merchantId], references: [id])
  // ...
}
model Merchant {
  users        User[]  // ❌ 期望多个用户，但 unique 约束阻止
}
```

**风险**：商户无法雇佣 STAFF 协助管理，与 schema 设计的 `users User[]` 矛盾。
**修复方案**：去掉 `@unique`，改为 `@@index([merchantId])`。

---

#### P1-6. 前端 token 存 localStorage（XSS 可窃取）

**文件**：`apps/web/src/api/http.ts:22-26`、`apps/web/src/stores/auth.ts:62-63`

```typescript
localStorage.setItem('wm_access_token', payload.accessToken);
localStorage.setItem('wm_refresh_token', payload.refreshToken);
```

**风险**：任何 XSS 漏洞（如 footerHtml 注入）都能 `localStorage.getItem('wm_access_token')` 窃取 token。
**修复方案**：

- 后端改用 httpOnly + SameSite=Strict cookie 存储 access/refresh token
- 或至少把 refresh token 放 httpOnly cookie，access token 放内存（页面刷新时用 refresh 换新）

---

#### P1-7. 软删除用户后 email 被占用，无法重新注册

**文件**：`apps/api/src/modules/merchant-application/merchant-application.service.ts:43-48`

```typescript
const existingUser = await this.prisma.user.findUnique({
  where: { email: dto.contactEmail }, // ❌ 包含软删除用户
});
```

**风险**：用户被软删除后无法用同邮箱重新注册。
**修复方案**：`findFirst({ where: { email, deletedAt: null } })`，或在软删除时把 email 改为 `deleted_${uuid}@original.com`。

---

#### P1-8. USDT 支付确认在事务内发事件

**文件**：`apps/api/src/modules/payment/usdt.service.ts:111-137`

```typescript
await this.prisma.$transaction(async (tx) => {
  // 更新 Payment + Order
  this.eventEmitter.emit(ORDER_PAID_EVENT, payload); // ❌ 事务内发事件
});
```

**风险**：若事务回滚但事件已发出，发卡流程会基于未提交的状态发卡。NestJS EventEmitter 默认同步，事件处理在事务内执行，进一步放大问题。
**修复方案**：事件移到事务外：

```typescript
const result = await this.prisma.$transaction(async (tx) => { ... });
this.eventEmitter.emit(ORDER_PAID_EVENT, payload);
```

---

#### P1-9. payment.service 金额比较用字符串

**文件**：`apps/api/src/modules/payment/payment.service.ts:173-174`

```typescript
if (order.totalAmount.toString() !== notify.amount) {
  throw new Error(`金额不匹配 order=${order.totalAmount} notify=${notify.amount}`);
}
```

**风险**：`Decimal(10.00).toString()` 是 `"10.00"`，而通道回调可能是 `"10"` 或 `"10.0"`，会被误判不匹配，导致支付失败。
**修复方案**：用数值比较：

```typescript
if (Number(order.totalAmount) !== Number(notify.amount)) {
  throw new Error(...);
}
```

---

#### P1-10. 限流计数出错时不重置（被注释为"防绕过"实际有 bug）

**文件**：`apps/api/src/common/interceptors/throttle.interceptor.ts:62-68`

```typescript
return next.handle().pipe(
  tap({
    error: () => {
      // 出错不重置计数，避免攻击者通过构造 4xx 绕过限流
    },
  }),
);
```

**风险**：注释说防绕过，但实际 `tap` 的 error 回调是空的，没做任何事。这是 dead code。OK 但没意义。
**修复方案**：删除这段无意义代码，或改为：4xx 错误也不重置（已经是当前行为）。

---

#### P1-11. ShopHostMiddleware 主域名硬编码

**文件**：`apps/api/src/common/middlewares/shop-host.middleware.ts:36`

```typescript
const mainDomains = ['winmelon.cn', 'www.winmelon.cn', 'localhost'];
```

**风险**：换域名要改代码；商户自定义域名若是 `shop.winmelon.cn` 子域会被错误识别为主域。
**修复方案**：用环境变量 `MAIN_DOMAINS=winmelon.cn,www.winmelon.cn`。

---

#### P1-12. shophost 每次请求都查 DB

**文件**：`apps/api/src/common/middlewares/shop-host.middleware.ts:42-46`
**风险**：高并发下每个 GET 请求（包括静态资源之外的页面）都查 `shop.findFirst`。
**修复方案**：用 Redis 缓存 `shop:domain:${host}` -> `shopCode`，TTL 5 分钟。

---

#### P1-13. shop.service 内存过滤库存为 0 的商品

**文件**：`apps/api/src/modules/shop/shop.service.ts:67-75`

```typescript
items: items.map(...).filter((p) => p.stock > 0),
total,  // ❌ total 是过滤前的总数
```

**风险**：分页失效。请求 pageSize=50 可能返回 30 个，前端按 50 渲染会出错。
**修复方案**：SQL 层用 `where: { stockCards: { some: { status: 'AVAILABLE' } } }`。

---

#### P1-14. Redis acquireLock 释放存在误删风险

**文件**：`apps/api/src/infrastructure/redis/redis.service.ts:25-32`

```typescript
async acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const result = await this.set(key, '1', 'PX', ttlMs, 'NX');  // value 固定 '1'
  return result === 'OK';
}
async releaseLock(key: string): Promise<void> {
  await this.del(key);  // ❌ 锁过期后被别人获取，这里会删别人的锁
}
```

**修复方案**：用 Lua 脚本原子释放：

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

acquireLock 时 value 用 randomBytes，release 时传入 value 校验。

---

### 🟡 P2 - 低危（建议修复）

#### P2-1. CORS 未包含商户自定义域名

**文件**：`apps/api/src/main.ts:32-38`

```typescript
origin: frontendUrl.split(',').map((s) => s.trim()),
```

商户自定义域名（如 `shop.example.com`）访问 API 时会被 CORS 拦截。
**修复方案**：动态从 DB 加载已验证的 customDomain 加入 allowed origins；或允许所有 `*.winmelon.cn` + 已验证商户域名。

---

#### P2-2. Swagger 在生产环境暴露

**文件**：`apps/api/src/main.ts:28, 64-91`

```typescript
const enableSwagger = config.get<string>('ENABLE_SWAGGER', 'true') !== 'false';
```

默认开启。生产 `https://winmelon.cn/api/docs` 公开访问，泄露 API 结构。
**修复方案**：默认 `false`，仅 dev/staging 开启；或加 IP 白名单 / Basic Auth。

---

#### P2-3. ResponsesController 路由守卫：STAFF 无后台访问权限

**文件**：`apps/web/src/router/index.ts:217-235`

```typescript
const isMerchant = roles.includes('MERCHANT');
if (isMerchantArea && !isMerchant && !isSuperAdmin) {
  ElMessage.warning('该区域仅限商户访问');
  return { path: auth.defaultRedirect };
}
```

STAFF 角色无法访问任何后台，但 schema 设计 STAFF 是商户员工。
**修复方案**：`isMerchantArea` 允许 MERCHANT + STAFF 访问，后端用 merchantId 数据隔离。

---

#### P2-4. MERCHANT 访问 /admin/merchant-applications alias 到不存在的 /merchant 路由

**文件**：`apps/web/src/router/index.ts:222-225`

```typescript
if (isAdminArea && !isSuperAdmin && isMerchant) {
  const aliasPath = to.path.replace(/^\/admin/, '/merchant');
  return { path: aliasPath, query: to.query, hash: to.hash };
}
```

如 MERCHANT 访问 `/admin/merchant-applications` → alias 到 `/merchant/merchant-applications`（不存在）→ 404。
**修复方案**：维护一个 admin→merchant 路由映射表，不存在的返回 `/merchant/dashboard`。

---

#### P2-5. passwordResetService 未使用的 jwtSecret 字段

**文件**：`apps/api/src/modules/auth/password-reset.service.ts:22, 32-33`

```typescript
private readonly jwtSecret: string;
// ...
this.jwtSecret = config.get<string>('JWT_SECRET') ?? 'change-me';  // ❌ 默认值 'change-me'
void jwt; // 占位防止未用警告
```

**风险**：误导后续维护者以为有 fallback 是 OK 的；后续若有人用 `this.jwtSecret` 签名 token 就会引入漏洞。
**修复方案**：删除 `jwtSecret` 字段和构造函数里的 jwt 参数。

---

#### P2-6. fetchMe 失败不尝试 refresh

**文件**：`apps/web/src/stores/auth.ts:98-105`、`apps/web/src/api/http.ts:45-49`
**风险**：access token 过期（15min）时直接跳登录，用户体验差。
**修复方案**：在 http.ts 加 response error 拦截器，401 时自动调用 `/auth/refresh`，成功后重试原请求。

---

#### P2-7. 雪花 ID 时钟回拨死循环风险

**文件**：`apps/api/src/infrastructure/id/snowflake.service.ts:55-60`

```typescript
if (this.sequence === 0n) {
  while (BigInt(Date.now()) <= this.lastTimestamp) {
    // spin wait  ❌ 系统时间卡住会死循环
  }
}
```

**修复方案**：加超时（如 spin 超过 5ms 抛错），或改用 `Atomics.wait`。

---

#### P2-8. 商户初始密码通过明文邮件发送

**文件**：`apps/api/src/modules/merchant-application/merchant-application.service.ts:122-130` + `mail.service.ts:228-290`
**风险**：邮件在传输链路上可能被截获（虽然 TLS 保护，但邮件服务器之间可能明文）。
**修复方案**：改用一次性激活链接（token 15 分钟有效），商户点击链接后自己设置密码。

---

#### P2-9. audit-log 写入失败被吞掉

**文件**：`apps/api/src/modules/audit-log/audit-log.service.ts:34-39`

```typescript
try {
  await this.prisma.auditLog.create({ data: ... });
} catch (err) {
  this.logger.error(`审计日志写入失败：${(err as Error).message}`);  // ❌ 静默
}
```

**风险**：关键操作（提现、密码重置、改密）的审计日志可能丢失，合规性问题。
**修复方案**：对关键操作（如 `withdrawal.*`、`password_reset.*`），审计失败应回滚业务事务。

---

#### P2-10. payment.service updateChannel 缺审计

**文件**：`apps/api/src/modules/payment/payment.service.ts:318-332`
**风险**：SUPER_ADMIN 修改支付通道配置（含密钥）无审计记录。
**修复方案**：加 `auditLog.record({ action: 'payment_channel.update', ... })`。

---

#### P2-11. withdraw.controller pageSize 无上限

**文件**：`apps/api/src/modules/withdrawal/withdrawal.controller.ts:65-80`

```typescript
return this.service.listForMerchant(user.merchantId, {
  page: page ? Number(page) : 1,
  pageSize: pageSize ? Number(pageSize) : 20, // ❌ 无 Math.min 限制
  status,
});
```

**修复方案**：`pageSize: Math.min(Number(pageSize) ?? 20, 100)`。

---

#### P2-12. Order 模型缺 merchantId，查询需 join

**文件**：`prisma/schema.prisma:215-244`
**风险**：商户查询订单需 `where: { shop: { merchantId } }`，多表 join 性能差。
**修复方案**：Order 加 `merchantId String` 字段 + `@@index([merchantId, status, createdAt])`。

---

#### P2-13. ShopHostMiddleware 不重写 POST 请求

**文件**：`apps/api/src/common/middlewares/shop-host.middleware.ts:22`

```typescript
if (req.method !== 'GET') return next(); // ❌ POST 请求不重写
```

商户自定义域名的买家下单时，前端 POST `/api/shop/:code/orders` 需要先知道 shopCode。但中间件不重写 POST，前端需自己解析 host。
**修复方案**：前端通过响应头或 meta 标签传递 shopCode。

---

#### P2-14. delivery.sendDeliveryEmail 失败不重试

**文件**：`apps/api/src/modules/delivery/delivery.service.ts:140-142`

```typescript
this.sendDeliveryEmail(payload).catch((err) => {
  this.logger.error(`卡密邮件发送失败...`);
});
```

**风险**：邮件发送失败买家收不到卡密，需要手动联系客服。
**修复方案**：加 Redis 队列重试 3 次；或后台提供"重发卡密邮件"按钮。

---

#### P2-15. README.md 中的 CI badge 指向 OWNER/wm-card

**文件**：`README.md:5`

```markdown
[![CI](https://github.com/OWNER/wm-card/actions/workflows/ci.yml/badge.svg)](...)
```

**修复方案**：替换 OWNER 为实际 GitHub 用户名/组织名。

---

## 2. 架构与设计建议

### 2.1 全局异常处理统一化

建议增加一个 `BusinessException` 基类，所有业务错误继承它，避免 `throw new Error()` 散落各处。可加 ESLint 规则 `no-throw-error` 强制。

### 2.2 引入 `class-validator` 全局 DTO 校验

当前 DTO 用 `@IsString` `@IsInt` 等，但部分 controller 直接 `@Body() body: { orderNo: string }` 没用 DTO class（如 `payment.controller.ts:72`）。建议全部 DTO 化。

### 2.3 引入 `helmet` 的 `contentSecurityPolicy`

当前 `app.use(helmet())` 用默认配置，CSP 不严格。建议显式配置 `default-src 'self'`，禁止 inline script。

### 2.4 数据库索引补全

建议加：

- `Order: @@index([merchantId, status, createdAt])`（加 merchantId 字段后）
- `Payment: @@index([orderId, status])` 查询订单的支付记录
- `Withdrawal: @@index([status, requestedAt])` 平台审核列表

### 2.5 部署建议

- **main.js 旧版覆盖问题**：把 `new ShopHostMiddleware(prismaService)` 这行直接提交到 Dockerfile 的 CMD 之前，或写一个 `entrypoint.sh` 在启动前校验 main.js 版本。
- **Docker 镜像扫描**：CI 加 `trivy image` 扫描漏洞。
- **DB 备份加密**：当前 `mysqldump` 明文备份，建议 `gpg --encrypt` 后存储。

### 2.6 监控与告警

- 当前只有 `mail.sendAlert`，但没看到实际触发点。建议加：
  - API 5xx 错误率 > 1% 告警
  - 订单支付成功率 < 95% 告警
  - 提现申请堆积 > 10 条告警
  - DB 连接池耗尽告警

---

## 3. Roadmap 优先级调整建议

基于本次审计，建议在原 P0/P1/P2 路线图前先插入"修复冲刺"：

| 优先级 | 任务                             | 预估工作量 |
| ------ | -------------------------------- | ---------- |
| 🚨 S0  | 修复 P0-1 ~ P0-7（7 个高危）     | 2-3 天     |
| 🚨 S0  | 修复 P1-1 ~ P1-4（4 个中危安全） | 1-2 天     |
| ⏳ S1  | 修复 P1-5 ~ P1-14（10 个中危）   | 2-3 天     |
| ⏳ S1  | 原 P0-3 生意罗盘 UV              | 2 天       |
| ⏳ S2  | 修复 P2-* （15 个低危）          | 滚动修复   |
| ⏳ S2  | 原 P1/P2 路线图                  | 按原计划   |

---

## 4. 已审计文件清单

### 后端（apps/api/src）

- ✅ `main.ts` - 启动配置、CORS、Helmet、全局管道
- ✅ `common/filters/all-exceptions.filter.ts`
- ✅ `common/interceptors/response.interceptor.ts` + `throttle.interceptor.ts`
- ✅ `common/guards/roles.guard.ts`
- ✅ `common/middlewares/shop-host.middleware.ts` + `request-id.middleware.ts`
- ✅ `infrastructure/prisma/prisma.service.ts`
- ✅ `infrastructure/redis/redis.service.ts`
- ✅ `infrastructure/crypto/aes-gcm.service.ts`
- ✅ `infrastructure/id/snowflake.service.ts`
- ✅ `infrastructure/mail/mail.service.ts`
- ✅ `modules/auth/` 全部文件（service/controller/strategy/guard/password-reset）
- ✅ `modules/withdrawal/` 全部文件
- ✅ `modules/product/` controller + service
- ✅ `modules/order/` controller + service
- ✅ `modules/payment/` service + controller + usdt.service
- ✅ `modules/delivery/` service
- ✅ `modules/merchant-application/` service
- ✅ `modules/open-api/` controller + api-key.service + guard
- ✅ `modules/shop/` service + controllers
- ✅ `modules/stock/` controller + service（部分）
- ✅ `modules/audit-log/` service（部分）
- ✅ `modules/risk/` risk-control.service（部分）

### 前端（apps/web/src）

- ✅ `router/index.ts`
- ✅ `stores/auth.ts`
- ✅ `api/http.ts`

### 数据库与部署

- ✅ `prisma/schema.prisma` 全文
- ✅ `deploy/docker/api.Dockerfile`
- ✅ `docker-compose.prod.yml`
- ✅ `.env.example`

---

## 5. 结论

项目核心交易链路（下单 → 锁卡 → 支付 → 发卡）的事务设计和并发防护**做得不错**，但周边安全机制存在系统性疏漏：

1. **异常类型混乱**：全项目至少 8 处 `throw new Error()` 会让用户看到 500 错误，严重影响调试和用户体验
2. **敏感数据保护不力**：API Key、支付配置明文存储，DB 泄露后果严重
3. **密码学误用**：`Math.random()` 生成验证码/密码，理论上可预测
4. **XSS 攻击面**：`footerHtml` + 卡密内容直插 HTML，商户可攻击买家
5. **生产镜像臃肿**：包含 dev 依赖，攻击面大

建议优先完成 S0 修复冲刺（3-5 天），再继续推进 P0-3 生意罗盘等新功能。在 S0 完成前，建议：

- 暂停商户自助入驻（避免 API Key 明文存储问题扩大）
- 在 Nginx 层屏蔽 `/api/docs`（避免 Swagger 暴露）
- 监控异常 5xx 错误率

---

**审计完成。等待用户确认修复优先级和执行节奏。**
