# WM 官方虚拟卡密交易平台 —— 架构设计

> 版本：1.0.0 ｜ 修订日期：2026-07-11
> 状态：基线（MVP 阶段必须遵守，变更需经评审）

## 1. 设计原则

1. **安全优先**：源码将开源，默认"源码公开后依然安全"——零信任、最小权限、纵深防御。
2. **分层清晰**：表现 / 应用 / 领域 / 基础设施四层分离，依赖方向只能从外向内。
3. **可插拔**：支付通道、通知通道、风控规则均以适配器模式接入，可热替换。
4. **幂等优先**：所有外部副作用（发卡、回调、退款）必须幂等。
5. **可观测**：关键操作全链路日志 + 指标，出问题可溯源到订单 / 请求 ID。
6. **渐进演进**：MVP 跑闭环 → V2 多商户 → V3 风控 / 数据看板 / API。

## 2. 技术栈

| 层 | 选型 | 版本 | 说明 |
|----|------|------|------|
| 运行时 | Node.js | 20 LTS | 长期支持 |
| 后端框架 | NestJS | ^10 | IoC、模块化、TypeScript 原生 |
| 语言 | TypeScript | ^5.4 | 全量严格模式 |
| ORM | Prisma | ^5 | 类型安全、迁移版本化 |
| 主库 | MySQL | 8.0 | InnoDB、utf8mb4 |
| 缓存 | Redis | 7.x | 限流、锁、缓存、队列 |
| 前端框架 | Vue 3 | ^3.4 | Composition API |
| 前端构建 | Vite | ^5 | 极速 HMR |
| UI 库 | Element Plus | ^2 | 后台管理场景成熟 |
| 前端语言 | TypeScript | ^5.4 | 与后端共享类型 |
| 反代 | Nginx | ^1.24 | TLS、限流、静态资源 |
| 容器 | Docker / Compose | ^24 / ^2 | 一键部署 |
| 进程管理 | PM2（可选） | ^5 | 非 Docker 场景兜底 |

## 3. 分层架构

```
┌──────────────────────────────────────────────────────┐
│  Presentation 表现层                                   │
│  - HTTP Controller（REST API）                        │
│  - 中间件（鉴权、限流、CSRF、日志）                     │
│  - DTO 校验（class-validator）                         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│  Application 应用层                                    │
│  - UseCase / Service（编排领域逻辑）                   │
│  - 事务边界（Unit of Work）                            │
│  - 事件分发（Domain Event → 通知 / 风控）              │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│  Domain 领域层                                        │
│  - Entity / Value Object                              │
│  - Repository 接口（Prisma 实现）                      │
│  - 纯业务规则（库存扣减、卡密取发、订单状态机）          │
└──────────────────────────────────────────────────────┘
                        ↑ 依赖倒置
┌──────────────────────────────────────────────────────┐
│  Infrastructure 基础设施层                             │
│  - Prisma Repository 实现                             │
│  - Redis 客户端                                       │
│  - 支付通道适配器（微信 / 支付宝 / 虎皮椒 / 易支付）    │
│  - 通知适配器（邮件 / 短信）                           │
│  - 加密 / 哈希 / 雪花 ID / 文件存储                    │
└──────────────────────────────────────────────────────┘
```

依赖方向：**表现 → 应用 → 领域 ← 基础设施**。领域层不依赖任何外部实现。

## 4. 目录结构

```
wm-card/
├── README.md
├── ARCHITECTURE.md
├── CODING-STANDARD.md
├── SECURITY-BASELINE.md
├── PROJECT-PLAN.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example                      # 环境变量模板（不含真实值）
├── .gitignore
├── .editorconfig
├── .env                               # 本地开发（gitignore，不入库）
│
├── apps/
│   ├── api/                           # 后端 NestJS
│   │   ├── src/
│   │   │   ├── main.ts                # bootstrap
│   │   │   ├── app.module.ts
│   │   │   ├── config/                # 配置加载与校验
│   │   │   ├── common/                # 跨模块共享
│   │   │   │   ├── decorators/        # @CurrentUser、@Public 等
│   │   │   │   ├── filters/           # 全局异常过滤器
│   │   │   │   ├── guards/            # JWT、API Key、CSRF
│   │   │   │   ├── interceptors/      # 响应包装、审计日志
│   │   │   │   ├── middlewares/       # 限流、请求 ID、安全头
│   │   │   │   ├── pipes/             # 全局 ValidationPipe
│   │   │   │   └── utils/             # 仅放纯函数
│   │   │   ├── modules/               # 业务模块（每个一个目录）
│   │   │   │   ├── auth/
│   │   │   │   ├── user/
│   │   │   │   ├── merchant/          # V2
│   │   │   │   ├── shop/              # 店铺
│   │   │   │   ├── product/           # 商品
│   │   │   │   ├── stock/             # 卡密库存
│   │   │   │   ├── order/
│   │   │   │   ├── payment/           # 支付聚合
│   │   │   │   │   ├── adapters/      # 各支付通道适配器
│   │   │   │   │   ├── payment.service.ts
│   │   │   │   │   └── payment.module.ts
│   │   │   │   ├── delivery/          # 发卡
│   │   │   │   ├── notify/            # 通知（邮件/短信）
│   │   │   │   ├── risk/              # 风控（V3）
│   │   │   │   └── admin/             # 后台管理
│   │   │   ├── infrastructure/        # 基础设施实现
│   │   │   │   ├── prisma/
│   │   │   │   ├── redis/
│   │   │   │   ├── crypto/
│   │   │   │   └── id/                # 雪花 ID
│   │   │   └── types/
│   │   ├── test/                      # e2e + 集成测试
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── nest-cli.json
│   │
│   └── web/                           # 前端 Vue3
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   ├── router/
│       │   ├── stores/                # Pinia
│       │   ├── api/                   # axios 封装、拦截器
│       │   ├── views/
│       │   │   ├── shop/              # 买家下单页 / 查询页
│       │   │   └── admin/             # 后台管理
│       │   ├── components/
│       │   ├── composables/
│       │   ├── utils/
│       │   └── types/                 # 与后端共享类型
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                          # 共享包
│   └── shared-types/                 # 前后端共享 DTO / 枚举
│       └── src/index.ts
│
├── deploy/
│   ├── nginx/
│   │   ├── wm-card.conf
│   │   └── ssl/                       # 证书（不入库）
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   └── web.Dockerfile
│   └── scripts/
│       ├── install.sh                 # 一键部署
│       └── backup.sh
│
└── docs/
    ├── api/                           # OpenAPI 产物
    ├── erd/                            # 数据库 ER 图
    └── adr/                           # 架构决策记录
```

## 5. 模块职责（MVP 范围）

| 模块 | 职责 | 关键点 |
|------|------|--------|
| auth | 登录、JWT、刷新令牌、密码哈希 | bcrypt + JWT 短期 + Refresh |
| user | 管理员、（V2）商户账号 | RBAC 角色 |
| product | 商品 CRUD、分类、上下架 | 软删除 |
| stock | 卡密批量导入、库存计数、原子取卡 | 行锁 + 唯一索引 + 加密存储 |
| order | 下单、锁库存、超时释放、状态机 | 雪花 ID、幂等 |
| payment | 多通道聚合、回调验签、订单绑定 | 适配器模式、严格验签 |
| delivery | 支付成功 → 取卡 → 展示 / 通知 | 幂等：同一订单只发一次 |
| admin | 后台管理、数据看板 | 全部需要管理员角色 |
| shop | 店铺装修、公告、商品展示 | 路径式：`/shop/:merchantCode` |

## 6. 关键流程

### 6.1 下单 → 支付 → 发卡（核心闭环）

```
买家访问店铺页
  ↓ 选择商品 → 填邮箱/联系方式
  ↓ POST /api/order
  ├─ 校验商品状态、库存 > 0
  ├─ 事务：预扣库存（stock.locked +1） + 创建订单(status=pending)
  ├→ 返回订单号 + 支付参数
  ↓ 跳转 / 扫码支付
  ↓ 支付通道异步回调 /api/payment/notify/:channel
  ├─ 验签（HMAC / RSA，按通道）
  ├→ 幂等校验（order_id 已处理则直接 ACK）
  ├→ 事务：订单 status=paid + 取卡（SELECT...FOR UPDATE 取一张未售卡密）
  ├→ 标记卡密 sold + 关联订单
  ├→ 发布 OrderPaidEvent
  ↓ 异步消费事件
  ├→ 发邮件 / 短信（限频）
  └→ 买家可在订单页查看卡密（需订单号 + 联系邮箱查询）
```

**并发安全**：取卡使用 `SELECT ... FOR UPDATE` + 卡密表 `order_id` 唯一索引兜底；订单号用雪花 ID 防爆破。

### 6.2 订单超时释放

- 下单时写入 `expire_at = now + 10min`（可配置）。
- 定时任务每 60s 扫描 `pending && expire_at < now` → 事务释放库存 + 订单标记 `expired`。
- 兜底：支付回调若发现订单已 expired，触发自动退款（V2）。

### 6.3 多店铺访问（路径式）

- 平台自营：`/shop/main` 或根路径。
- 商户店铺：`/shop/:merchantCode`。
- V3 增强：商户可在后台绑定独立域名，Nginx 通过 `Host` 路由到对应 `merchantCode`。

## 7. 数据模型（核心表）

> 完整 Prisma schema 在 `apps/api/prisma/schema.prisma`，此处只列核心字段与关系。

```
User           管理员 / 商户账号（V2 商户）
Merchant       商户信息（V2）
Shop           店铺（1 商户 1 主店铺）
ProductCategory
Product        商品（属店铺）
StockCard      卡密（属商品，AES-256-GCM 加密 content，存 ciphertext+iv+tag）
Order          订单（属店铺）
OrderItem      订单项（商品 + 单价 + 数量）
OrderCard      订单-卡密关联（订单 ID + 卡密 ID 唯一索引）
Payment        支付记录（通道、流水号、回调原始数据）
PaymentChannel 支付通道配置（加密存储密钥）
AuditLog       审计日志
RateLimitBuckets Redis（不入主库）
```

## 8. 横切关注点

### 8.1 配置管理
- 所有配置走环境变量，`.env` 不入库。
- 启动时用 `class-validator` 校验必填项，缺失即拒绝启动。
- 敏感配置（卡密加密 Key、JWT Secret、支付密钥）从环境变量读，**禁止入库、禁止日志**。

### 8.2 日志
- 结构化 JSON 日志（pino）。
- 每条日志携带 `requestId`、`userId`、`merchantCode`、`orderId`（如有）。
- **禁止记录**：卡密明文、密码、支付原始密钥、token。
- 日志级别：dev=debug，prod=info，支付/发卡关键路径=info 以上。

### 8.3 错误处理
- 全局异常过滤器统一响应结构。
- 业务异常用领域特定 Error 类（`OrderExpiredError`、`OutOfStockError`）。
- 5xx 必须记录堆栈，4xx 只记录请求上下文。

### 8.4 限流
- 全局：每 IP 60 req/min。
- 下单接口：每 IP 10/min。
- 订单查询接口：每 IP 30/min。
- 支付回调：按通道白名单 IP + 签名双重校验。

### 8.5 幂等
- 下单：基于前端预生成 `idempotencyKey`。
- 支付回调：订单号唯一 + Redis `SETNX` 锁。
- 发卡：订单 `delivery_status` 字段 + 唯一索引。

## 9. 部署拓扑

```
                 Internet
                    │
                    ▼
              ┌───────────┐
              │  Nginx    │ ← TLS、限流、静态资源
              └─────┬─────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   ┌─────────┐            ┌─────────┐
   │ API(Vue)│            │ API API │  ← Docker
   │ 静态资源 │            │ NestJS  │
   └─────────┘            └────┬────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
          ┌──────────┐                 ┌──────────┐
          │  MySQL   │                 │  Redis   │
          └──────────┘                 └──────────┘
```

香港服务器 `162.251.93.5`（不入库 IP）单机部署，Docker Compose 编排所有服务。

## 10. 架构决策记录（ADR）索引

变更需在 `docs/adr/` 新建 ADR 文档，编号递增：

- ADR-0001 选择 NestJS 而非 ThinkPHP
- ADR-0002 使用 Prisma 而非 TypeORM
- ADR-0003 卡密加密采用 AES-256-GCM
- ADR-0004 订单号采用雪花 ID 而非自增
- ADR-0005 支付通道采用适配器模式
- ADR-0006 多商户访问采用路径式优先

## 11. 变更流程

本文件是项目基线。任何架构变更必须：
1. 新建 ADR 说明背景、决策、后果。
2. 评审通过后更新本文件并打 tag。
3. 同步通知所有模块负责人。
