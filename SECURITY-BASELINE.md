# WM 官方虚拟卡密交易平台 —— 安全基线

> 版本：1.0.0 ｜ 修订日期：2026-07-11
> 状态：强制（源码将开源，"安全靠代码不公开"是绝对禁止的设计假设）

## 0. 核心威胁模型

本项目作为开源发卡网，源码完全公开，意味着攻击者可：
1. 拿到全部源码、数据库 schema、所有接口签名。
2. 离线审计代码找漏洞，无"安全靠代码不公开"的庇护。
3. 搭建实例研究行为模式，构造攻击 payload。
4. 利用公开仓库历史 commit 找曾经泄露的密钥。

**因此本基线只允许"即使源码、密钥配置全公开依然安全"的方案**。任何依赖"代码不公开"的"安全措施"一律视为漏洞。

### 关键资产
| 资产 | 敏感等级 | 保护手段 |
|------|----------|----------|
| 卡密明文 | 极高 | AES-256-GCM 加密存储，密钥仅在内存 |
| 用户密码 | 极高 | bcrypt cost≥12 |
| JWT Secret | 极高 | 环境变量，≥ 256 bit 随机 |
| 支付密钥 | 极高 | 环境变量 + 加密存配置 |
| 订单 / 卡密关联 | 高 | 行锁 + 唯一索引 + 幂等 |
| 买家联系方式 | 中高 | 加密 / 脱敏存储 |
| 审计日志 | 中 | 不可篡改，仅追加 |

### 核心攻击面
1. 支付回调伪造（白嫖卡密，最高危）
2. 卡密并发超卖
3. 订单号爆破枚举他人卡密
4. 商户 / 管理员越权
5. 商户自定义内容存储型 XSS
6. 文件上传 RCE
7. SQL 注入（发卡网重灾区）
8. 邮件 / 短信轰炸
9. 恶意下单占库存
10. 模板注入 / SSRF

---

## 1. 输入校验

### 1.1 强制规则
- 所有外部输入（HTTP body / query / param / header）必须经 DTO + `ValidationPipe` 校验。
- `ValidationPipe` 全局配置：
  ```ts
  new ValidationPipe({
    whitelist: true,           // 剥离未声明字段
    forbidNonWhitelisted: true, // 多余字段直接 400
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  })
  ```
- 字段必须声明类型与约束（`@IsString`、`@IsInt`、`@MinLength`、`@IsEnum` 等）。
- 字符串字段必须限制 `@MaxLength`，防超长 payload。

### 1.2 业务约束
- 邮箱用 `@IsEmail`，下单必填。
- 手机号用 `@Matches(/^1[3-9]\d{9}$/)`。
- 商品名 / 公告等富文本字段长度 ≤ 255，超过走单独长文本字段且强制转义。
- 金额用整数（分），禁止浮点。

---

## 2. SQL 注入防护

- **统一走 Prisma**：禁止原生 SQL 拼接。
- 必须用 `$queryRaw` 时，使用模板字符串参数化：
  ```ts
  // ✅ 安全
  await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`
  // ❌ 禁止
  await prisma.$queryRaw(`SELECT * FROM users WHERE id = '${userId}'`)
  ```
- 复杂查询优先用 `prisma.$queryRawUnsafe` 的反例：**禁止使用**，必须用模板字符串。
- CI 增加 ESLint 规则禁止 `$queryRawUnsafe`。

---

## 3. XSS 防护

### 3.1 输出转义
- Vue 模板默认转义 `{{ }}`。
- **禁用 `v-html`**，除非内容来自可信源（如管理员预定义模板片段）。
- 必须用 `v-html` 时，前置 `DOMPurify.sanitize()`。

### 3.2 存储型 XSS 重灾区
- 商户自定义字段：店铺名、公告、商品描述、页脚、自定义 HTML。
- 这些字段**存储原始内容，输出时强制 sanitize**。
- 富文本字段单独标记 `isRichText: true`，在 service 层输出前统一处理。

### 3.3 CSP
- Nginx 配置 `Content-Security-Policy`：禁止内联脚本（除 nonce）、禁止 `unsafe-eval`、限制外链域名白名单。

---

## 4. CSRF 防护

- 后台管理接口（cookie 鉴权）必须 CSRF Token（Double Submit Cookie 模式）。
- 买家下单接口用 `idempotencyKey` + JWT（无 cookie），可豁免。
- 支付回调接口豁免 CSRF（无 cookie），但必须验签。

---

## 5. 鉴权与越权

### 5.1 鉴权方式
| 接口 | 方式 |
|------|------|
| 管理员后台 | JWT（短期）+ Refresh Token（HttpOnly Cookie） |
| 商户后台 | 同上，但绑定 merchantId |
| 买家下单 / 查询 | 无鉴权，但订单查询需 `订单号 + 联系邮箱` 双因子 |
| 支付回调 | IP 白名单 + 验签 |
| 开放 API（V3） | API Key + HMAC 签名 |

### 5.2 越权防护
- **每个数据访问必须带归属过滤**：
  ```ts
  // ✅ 安全
  prisma.order.findFirst({ where: { id, merchantId: user.merchantId } })
  // ❌ 危险
  prisma.order.findFirst({ where: { id } })
  ```
- 写操作必须先查归属，未找到视为 404（不暴露存在性）。
- 商户 A 查询 / 修改商户 B 资源 → 必须返回 404，不得返回 403（避免信息泄露）。

### 5.3 RBAC
- 角色：`super_admin` / `merchant` / `staff`（V2）。
- 资源 - 操作矩阵在 `auth.permission` 模块集中管理。
- 禁止在 controller 内分散判断角色，统一用 `@Roles()` 装饰器 + Guard。

---

## 6. 卡密存储与取发

### 6.1 存储加密
- 卡密明文使用 **AES-256-GCM** 加密后入库。
- 表字段：`content_ciphertext`、`content_iv`、`content_tag`，**禁止存明文**。
- 加密密钥来自环境变量 `CARD_ENCRYPTION_KEY`，≥ 32 字节随机，不入库不入日志。
- 密钥轮换：保留旧密钥 ID，解密时按 ID 选密钥。

### 6.2 取发并发安全
```sql
-- 取卡（事务内）
SELECT id FROM stock_card
WHERE product_id = ? AND status = 'available'
ORDER BY id ASC
FOR UPDATE LIMIT 1;
-- 更新为 sold + 关联订单（依赖 order_id 唯一索引兜底）
UPDATE stock_card SET status='sold', order_id=? WHERE id=? AND status='available';
```
- 必须 `FOR UPDATE`，且条件包含 `status = 'available'`。
- `stock_card.order_id` 设唯一索引（防同一订单重复取卡）。
- 影响 0 行时视为库存耗尽，回滚事务。

### 6.3 卡密查看
- 买家查看订单时返回卡密明文（已解密）。
- 必须验证 `订单号 + 联系邮箱` 双因子匹配。
- 查看即记录 `viewed_at`，作为"已确认收货"依据（防退款纠纷）。

---

## 7. 订单安全

### 7.1 订单号生成
- **必须不可枚举**：雪花 ID 或 UUID v7，禁止自增。
- 订单查询接口同时校验 `订单号 + 联系邮箱`，缺一不可。

### 7.2 订单状态机
```
pending → paid → delivered
pending → expired
paid → refunded (V2)
```
- 状态转换走 service 层 `OrderStatusMachine`，禁止直接改字段。
- 非法转换抛 `IllegalStatusTransitionError`。

### 7.3 超时释放
- `expire_at = now + 10min`。
- 定时任务每 60s 扫描过期 pending 订单 → 释放库存。
- 释放使用乐观锁：`UPDATE ... SET status='expired' WHERE id=? AND status='pending'`，影响 0 行说明已被处理。

---

## 8. 支付安全

### 8.1 通道适配器
- 每个支付通道实现 `PaymentAdapter` 接口：
  ```ts
  interface PaymentAdapter {
    createPayment(order): Promise<PaymentParams>
    verifyNotify(rawBody: string, headers: Record<string,string>): NotifyVerifyResult
    parseNotify(rawBody: string): NotifyData
  }
  ```
- 通道配置（密钥、商户号）加密存 `payment_channel` 表，密钥从环境变量读。

### 8.2 回调验签（最高危）
- **必须验证签名**，按通道：
  - 微信官方：RSA-SHA256，证书校验。
  - 支付宝官方：RSA2。
  - 虎皮椒 / 易支付 / 码支付：HMAC-MD5 / MD5（按通道，必须含全部必填字段 + 密钥）。
- **验签失败必须返回 4xx 并记录告警**，禁止 ACK。
- **验签通过但订单不匹配 / 已处理**：仍返回 ACK（防重放攻击被利用做枚举）。
- **回调必须幂等**：Redis `SETNX order:{orderId}:notify` 5min 锁。

### 8.3 回调原始数据
- 原始请求体 + 头部全文存 `payment.notify_raw`，用于事后审计。
- 敏感字段（如签名密钥）脱敏后存。

### 8.4 通道白名单
- 每个通道维护官方回调 IP 段，Nginx 层 + 应用层双重校验。

---

## 9. 限流与防爆破

### 9.1 限流策略
| 接口 | 限流 |
|------|------|
| 全局 | 60 req/min/IP |
| 下单 `POST /order` | 10 req/min/IP |
| 订单查询 | 30 req/min/IP |
| 后台登录 | 5 req/min/IP |
| 邮件 / 短信发送 | 1 req/min/收件方 + 10/hour/IP |

- 用 Redis 令牌桶 / 滑动窗口。
- 超限返回 429 + `Retry-After`。

### 9.2 行为风控
- 同一 IP 60s 内下单 ≥ 5 次未支付 → 封禁 30min。
- 同一邮箱 1 小时内下单 ≥ 3 次未支付 → 拉黑 24h。
- 异常 User-Agent（空、curl、python-requests）→ 强制验证码。

### 9.3 验证码
- 下单接口在以下场景触发：
  - 当日同 IP 下单 ≥ 3 次。
  - 商品限购触发。
  - 异常 UA。
- 用 hCaptcha / 自建滑块（V3）。

---

## 10. 文件上传

### 10.1 通用规则
- 白名单扩展名：`jpg/jpeg/png/gif/webp/csv`。
- **Magic bytes 校验**：禁止只看扩展名。
- 重命名为 `uuid + 原扩展名`，禁止保留原文件名。
- 存储路径：非 web root（如 `/data/uploads`），通过专用接口代理读取。
- 限制大小：图片 ≤ 2MB，CSV ≤ 5MB。

### 10.2 卡密 CSV 导入
- 仅管理员 / 商户可调用。
- 解析前校验：行数 ≤ 10万、列数符合预期、单行长度 ≤ 1KB。
- 解析失败的行跳过并记录，不中断整体导入。
- 导入任务异步执行，防止长连接超时。

---

## 11. 邮件 / 短信安全

- 发送接口需要鉴权 + 限频（见 §9）。
- 模板固定，变量严格转义（防邮件内容注入）。
- 收件人邮箱 / 手机号服务端校验格式，禁止客户端直传收件人列表。
- 同一收件人 1 小时最多 5 封，1 天最多 20 封。

---

## 12. 密钥与配置管理

### 12.1 强制规则
- 所有密钥从环境变量读，禁止入库。
- `.env` 在 `.gitignore` 内，`.env.example` 入库只放占位符。
- 密钥生成：`crypto.randomBytes(32).toString('hex')`，禁止人脑想。
- CI 启动时校验必填环境变量，缺失即拒绝启动。

### 12.2 密钥清单
| 变量 | 用途 | 要求 |
|------|------|------|
| `JWT_SECRET` | JWT 签名 | ≥ 64 字节随机 |
| `JWT_REFRESH_SECRET` | 刷新令牌 | 与上不同，≥ 64 字节 |
| `CARD_ENCRYPTION_KEY` | 卡密加密 | 32 字节随机（base64） |
| `SESSION_SECRET` | Cookie 签名 | ≥ 32 字节 |
| `DB_PASSWORD` | DB 密码 | ≥ 16 字节 |
| `REDIS_PASSWORD` | Redis 密码 | ≥ 16 字节 |
| 各支付通道密钥 | 见通道配置 | 按通道要求 |

### 12.3 密钥轮换
- JWT Secret 每 90 天轮换，旧 Secret 保留 7 天用于存量校验。
- 卡密加密 Key 支持多版本，加密时写入 `key_id`。

---

## 13. 日志与审计

### 13.1 审计日志
所有以下操作必须落 `audit_log` 表：
- 商品 / 卡密增删改。
- 订单状态变更（含支付回调触发的）。
- 后台用户登录 / 权限变更。
- 通道配置变更。
- 卡密查看（含买家查询）。

字段：`actor` / `action` / `resourceType` / `resourceId` / `before` / `after` / `ip` / `userAgent` / `requestId` / `createdAt`。

### 13.2 日志脱敏
- 卡密：只记 `cardId`。
- 手机号：`13****1234`。
- 邮箱：`a***@b.com`（保留前 1 + @ + 域名）。
- 密码 / token / 密钥：禁止出现。

### 13.3 日志防篡改
- 关键审计日志仅追加，禁止 update / delete（应用层 + DB 层双保险）。

---

## 14. HTTP 安全头

Nginx / NestJS 必须设置：

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{nonce}'; ...
```

- Cookie 设置 `HttpOnly`、`Secure`、`SameSite=Lax`（关键接口 `Strict`）。

---

## 15. 依赖与供应链

- `npm audit` 必须通过，高危漏洞禁止合并。
- 依赖锁定版本，禁止 `*` / `latest`。
- 新增依赖 review 必须查看：维护活跃度、是否有已知漏洞、是否冗余。
- 定期 `npm outdated`，但升级需 PR 评审。

---

## 16. 部署安全

- 容器以非 root 用户运行（`USER node`）。
- 数据库容器禁止挂载到 0.0.0.0，只对内网容器暴露。
- Redis 禁止 0.0.0.0 + 必须密码。
- Nginx 限流（`limit_req`）兜底应用前。
- 证书用 Let's Encrypt 自动续期。
- 服务器 SSH：禁用密码登录，仅 Key（**用户当前提供的密码登录上线后立即改**）。
- 服务器开启 `fail2ban` 防 SSH 爆破。
- 定期备份 MySQL（每日全量 + binlog），备份文件加密。

---

## 17. 漏洞响应

- 发现漏洞 → 私下评估影响范围 → 修复分支 → 紧急 hotfix release → 公开披露（修复 7 天后）。
- 维护 `SECURITY.md`，声明漏洞披露流程与联系方式。
- 关键漏洞（如可白嫖卡密）必须打 `security` 标签并紧急评审。

---

## 18. 红线清单（违反即 reject）

1. 硬编码密钥 / 密码 / token 在源码、配置、文档中。
2. 卡密明文入库 / 入日志。
3. SQL 字符串拼接。
4. 用 `$queryRawUnsafe`。
5. `v-html` 未 sanitize。
6. 支付回调未验签 / 验签失败仍 ACK。
7. 取卡未加 `FOR UPDATE`。
8. `stock_card.order_id` 无唯一索引。
9. 订单号可枚举（自增 / 时间戳）。
10. 数据查询未带归属过滤（越权）。
11. 文件上传未做 magic bytes 校验。
12. `.env` 提交到 git。
13. 用 `console.log` 打印敏感数据。
14. 关闭 `ValidationPipe` 的 `forbidNonWhitelisted`。
15. 容器以 root 运行。
16. Redis / MySQL 暴露 0.0.0.0 无密码。
