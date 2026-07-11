# WM 官方虚拟卡密交易平台 —— 项目计划

> 版本：1.0.0 ｜ 修订日期：2026-07-11
> 状态：基线

## 0. 项目定位

- **项目名**：WM 官方虚拟卡密交易平台
- **形态**：开源发卡网，源码公开、可自部署
- **目标用户**：个人开发者 / 小团队卖家（自营）→ 后期支持商户入驻（多商户 SaaS）
- **部署**：单机 Docker Compose，首台实例部署在用户提供的香港服务器
- **技术栈**：NestJS + Vue3 + MySQL + Redis（详见 `ARCHITECTURE.md`）

## 1. 里程碑总览

| 里程碑 | 目标 | 关键交付 |
|--------|------|----------|
| **M0** 工程化基线 | 仓库、CI、规范就位 | 仓库结构、ESLint、CI 流水线、四份规范文档 |
| **M1** MVP 闭环 | 单商户自营跑通 | 商品 / 卡密 / 订单 / 支付 / 发卡 / 后台 |
| **M2** 上线 | 公网可访问 | Nginx + TLS + Docker 部署 + 1 个真实支付通道 |
| **M3** 加固 | 风控 / 监控 | 限流、审计、监控告警、备份脚本 |
| **V2** 多商户 | 商户入驻 | 商户系统、店铺、分账 |
| **V3** 增强 | 数据 / 开放 | 看板、API 开放、邮件短信、独立域名绑定 |

---

## 2. M0：工程化基线（先做）

### 交付清单
- [ ] 仓库初始化：`apps/api`、`apps/web`、`packages/shared-types`
- [ ] `.gitignore`、`.editorconfig`、`.env.example`
- [ ] ESLint + Prettier + husky + lint-staged
- [ ] TypeScript 严格模式配置
- [ ] Prisma 初始化 + schema 骨架
- [ ] NestJS bootstrap + 全局 ExceptionFilter + ValidationPipe + 日志中间件
- [ ] Vue3 + Vite + Pinia + Vue Router + ElementPlus 骨架
- [ ] Docker Compose（api、web、mysql、redis）
- [ ] CI：lint + build（GitHub Actions）
- [ ] README（项目简介 + 启动步骤）

### 验收标准
- `docker compose up` 一键启动本地开发环境。
- 访问 `http://localhost:5173` 看到前端欢迎页。
- `http://localhost:3000/health` 返回 `{ status: 'ok' }`。
- CI 全绿。

---

## 3. M1：MVP 闭环（核心）

### 3.1 范围
- 单商户自营（平台即商户本身）。
- 商品管理、卡密批量导入、订单、支付（1 个通道）、自动发卡。
- 买家：下单页 + 订单查询页（免注册）。
- 后台：管理员登录、商品 / 卡密 / 订单管理、基本统计。
- 不含：商户入驻、分账、邮件短信通知、风控增强。

### 3.2 数据库设计要点
- `users`：管理员（V2 兼容商户字段，但 MVP 只用管理员）
- `shops`：1 平台 1 主店铺
- `products`、`product_categories`
- `stock_cards`：`content` AES-256-GCM 加密，`order_id` 唯一索引
- `orders`、`order_items`、`order_cards`
- `payments`、`payment_channels`、`payment_notifies`
- `audit_logs`
- `system_configs`（KV 配置，如店铺名、公告）

### 3.3 模块开发顺序

#### 步骤 1：基础设施
- [ ] `prisma/schema.prisma` 全量建模
- [ ] `infrastructure/prisma/prisma.service.ts`
- [ ] `infrastructure/redis/redis.service.ts`
- [ ] `infrastructure/crypto/aes-gcm.service.ts`（卡密加密）
- [ ] `infrastructure/id/snowflake.service.ts`（订单号 / 卡密 ID）
- [ ] `common/middlewares/request-id.middleware.ts`
- [ ] `common/middlewares/rate-limit.middleware.ts`
- [ ] `common/filters/all-exception.filter.ts`
- [ ] `common/interceptors/response.interceptor.ts`
- [ ] `common/decorators/`（`@Public`、`@CurrentUser`、`@Roles`）

#### 步骤 2：鉴权
- [ ] `auth` 模块：登录、JWT、刷新令牌
- [ ] `JwtAuthGuard`、`RolesGuard`
- [ ] 密码 bcrypt 哈希
- [ ] 管理员账号 seed（首次启动自动建）

#### 步骤 3：商品与库存
- [ ] `product` 模块：CRUD、分类、上下架、软删除
- [ ] `stock` 模块：CSV 批量导入、查询、库存计数
- [ ] 卡密加密存储
- [ ] 库存预警（低于阈值日志告警）

#### 步骤 4：店铺与商品展示（买家侧）
- [ ] `shop` 模块：店铺信息、公告、商品列表
- [ ] 买家下单页（Vue）：`/shop/main`
- [ ] 订单查询页（Vue）：`/query`

#### 步骤 5：订单
- [ ] `order` 模块：下单（预扣库存）、查询、状态机
- [ ] 订单号雪花 ID
- [ ] 超时释放定时任务（`@nestjs/schedule`）
- [ ] 下单幂等（`idempotencyKey`）

#### 步骤 6：支付
- [ ] `payment` 模块骨架 + `PaymentAdapter` 接口
- [ ] 优先实现：**易支付（彩虹）适配器**（MVP 用，香港服务器友好、个人可用）
- [ ] 回调验签 + 幂等
- [ ] 通道配置后台页面

#### 步骤 7：自动发卡
- [ ] `delivery` 模块：监听 `OrderPaidEvent` → 取卡 → 标记 `delivered`
- [ ] 取卡并发安全（`FOR UPDATE` + 唯一索引）
- [ ] 买家订单页查看卡密（解密展示，记录 `viewed_at`）

#### 步骤 8：后台管理（Vue）
- [ ] 登录页
- [ ] 商品管理页（列表 / 编辑 / 上下架）
- [ ] 卡密管理页（导入 / 列表 / 库存统计）
- [ ] 订单管理页（列表 / 详情 / 手动补发）
- [ ] 支付配置页
- [ ] 系统配置页（店铺名、公告等）
- [ ] 数据看板（今日订单 / GMV / 库存数）

### 3.4 验收标准（MVP）
- [ ] 管理员可登录后台，创建商品，导入卡密 CSV。
- [ ] 买家访问 `/shop/main`，选择商品，填写邮箱，下单。
- [ ] 跳转易支付，支付成功后回调自动发卡。
- [ ] 买家在 `/query` 用 `订单号 + 邮箱` 查询订单并查看卡密。
- [ ] 未支付订单 10 分钟后自动释放库存。
- [ ] 并发测试：100 并发下单同一商品（库存 10），最终成功 10 单，无超卖。
- [ ] 验签绕过测试：伪造回调返回 4xx，无卡密发出。
- [ ] 越权测试：商户不存在 / 订单不属于当前用户均返回 404。

---

## 4. M2：上线

### 4.1 范围
- 香港 server 部署真实实例。
- 域名 + TLS。
- 至少 1 个真实支付通道（先易支付，后续可补微信 / 支付宝官方）。

### 4.2 任务
- [ ] 服务器初始化：SSH Key 登录、关闭密码登录、`fail2ban`、防火墙
- [ ] Docker + Compose 安装
- [ ] MySQL 数据卷 + 自动备份脚本（每日全量 + binlog）
- [ ] Redis 密码 + 仅本机暴露
- [ ] Nginx 配置：TLS、CSP、限流、静态资源、反代 API
- [ ] 前端构建产物部署（Nginx 静态托管）
- [ ] 后端 API 容器化部署
- [ ] `.env.prod` 注入（手动 SSH 配置，不入库）
- [ ] Let's Encrypt 证书自动续期
- [ ] 健康检查 + 日志收集

### 4.3 验收
- [ ] `https://<域名>` 可访问，TLS 评级 A+。
- [ ] 真实支付端到端跑通一笔小额订单。
- [ ] 备份脚本手动触发可恢复。

---

## 5. M3：加固

### 5.1 任务
- [ ] 限流策略全量上线（参考 `SECURITY-BASELINE.md` §9）
- [ ] 行为风控（IP / 邮箱黑名单、未支付次数熔断）
- [ ] 验证码（异常触发）
- [ ] 监控：Prometheus + Grafana（订单 / 支付 / 库存核心指标）
- [ ] 告警：异常回调验签失败、库存异常下降、5xx 飙升 → 邮件 / Telegram
- [ ] 审计日志后台查询页
- [ ] 安全扫描自动化（CI 跑 `npm audit` + Trivy 镜像扫描）

---

## 6. V2：多商户（暂不细化）

> 等 MVP 验证后细化。

- 商户注册 + 审核
- 商户独立后台（基于 `merchantId` 的 RBAC）
- 店铺装修（路径式 `/shop/:merchantCode`）
- 分账结算（暂不做自动清算，仅记录应付）
- 商户级支付通道配置

---

## 7. V3：增强（暂不细化）

- 数据看板增强（销量排行、趋势）
- 邮件 / 短信通知（下单成功、卡密发送）
- 开放 API（商户可对接自有渠道）
- 商户独立域名绑定
- USDT / 加密货币支付

---

## 8. 风险与待解决事项

| # | 事项 | 影响 | 计划 |
|---|------|------|------|
| R1 | 用户无支付商户号 | MVP 无法对接微信 / 支付宝官方 | MVP 用易支付，官方支付等商户号到位后补 |
| R2 | 香港服务器 | 国内访问延迟稍高，无法用国内 CDN | 可接受，未来可加 CDN |
| R3 | 服务器密码已在对话中暴露 | 安全风险 | M2 上线前改密码 + 改 SSH Key 登录 |
| R4 | 开源后攻击面增大 | 漏洞利用 | 严格遵守 `SECURITY-BASELINE.md`，CI 强制扫描 |
| R5 | 个人精力有限 | 进度可能波动 | 严格按里程碑，每个 M 单独验证 |

---

## 9. 立即开始的下一步

进入 M0 第一个任务：**仓库初始化 + 骨架搭建**。

具体动作：
1. 在 `D:/soft/wm-card` 下初始化 git 仓库。
2. 创建 `apps/api` NestJS 项目骨架。
3. 创建 `apps/web` Vue3 + Vite 项目骨架。
4. 配置 ESLint / Prettier / TypeScript 严格模式。
5. 配置 Docker Compose 本地开发环境。
6. 写 README + .env.example。

确认后我开始执行。
