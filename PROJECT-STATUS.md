# WM 官方虚拟卡密交易平台 —— 项目状态

> 修订日期：2026-07-15 ｜ 维护者：项目文档工程师
> 注：`PROJECT-PLAN.md` 保留原始规划，本文档记录实际进展和当前状态

## 1. 当前状态一览

### 1.1 里程碑完成度

| 里程碑            | 目标           | 状态    | 备注                                                    |
| ----------------- | -------------- | ------- | ------------------------------------------------------- |
| **M0** 工程化基线 | 仓库、CI、规范 | ✅ 完成 | 2026-07-08                                              |
| **M1** MVP 闭环   | 单商户自营跑通 | ✅ 完成 | 2026-07-09，含 8 项验收测试                             |
| **M2** 上线       | 公网可访问     | ✅ 完成 | 2026-07-10，部署到 `winmelon.cn`                        |
| **M3** 加固       | 风控 / 监控    | ✅ 完成 | 2026-07-11，含风控/审计/邮件/备份                       |
| **V2** 多商户     | 商户入驻       | ✅ 完成 | 2026-07-12，含申请/审核/独立工作台                      |
| **V3** 增强       | 数据 / 开放    | ✅ 完成 | 2026-07-13，含高级统计/开放 API/USDT/域名/提现/UV/公告  |
| **V4** 退款       | 退款流程       | ✅ 完成 | T3 实际退钱通道 + V4-7 财务对账 + T7 文档（2026-07-15） |

### 1.2 最新 30 次提交

```
4070a8d feat(p0-withdrawal): 提现结算 - 商户申请 + 平台审核 + 人工打款
0abace2 fix(admin-permission): SUPER_ADMIN 不受 merchantId 限制 + admin Layout 改版
dece9fc feat(merchant-ui): 商户工作台 UI 重新设计
f9bb7e2 feat(auth): 忘记密码功能 + 图形验证码
19cae41 feat(auth): 两个后台加修改密码控件
6a89dff feat(home-login): 首页加商户登录/平台后台登录入口
a16f253 feat(merchant-workspace): 商户工作台与平台后台分离
0c80bc4 fix(mail): MAIL_PORT 类型转换 + 稳健的 SMTP 配置
dac5825 feat(d-usdt-ui): USDT 支付前端页面 + QR 码
6f9e1ae feat(f-domain): 商户自定义域名绑定（DNS 验证）
f220748 feat(e-mail): 订单/入驻自动邮件通知
a0332b6 feat(merchant-apply): 邮箱验证码自动激活，去掉人工审核
808f77e feat(merchant-apply): 简化申请表单，去掉联系人姓名/电话
b2bcbed feat(c-usdt): USDT TRC20 加密货币支付通道
94a20bf feat(b-open-api): 开放 API + 商户入驻入口
6f34df5 fix(deploy): 修复 Docker 构建的 Prisma Client 问题
de481b9 feat(a-merchant): V2 多商户入驻申请 + 审核
9d1c1fb feat(e-stats): 数据看板增强 - 时段/漏斗/复购/客单价
293bef8 feat(d-swagger): Swagger API 文档集成
e7d48fa feat(t2): 第二梯队 - 行为风控（IP/邮箱黑名单 + 熔断）
37e1724 feat(t1): 第一梯队 - 审计日志页 + 看板图表 + 备份恢复验证
cdbdddc feat(m3-mail): 邮件通知 - 卡密交付 + 监控告警
79d36c8 feat(m3): 加固 - acme.sh 续期 + MySQL 备份 + 监控告警
476334c feat(m2-deploy): M2 上线到 winmelon.cn（混合部署）
e435069 feat(m2-local): M2 上线本地准备 - Docker/Nginx/脚本/证书
126b319 feat(m1-finalize): M1 收尾 - 价格序列化 + 系统配置页 + 3 项验收测试
```

---

## 2. 已实现功能矩阵

### 2.1 买家侧

| 功能                         | 路径                | 状态 | 备注                         |
| ---------------------------- | ------------------- | ---- | ---------------------------- |
| 首页（含公告/特性/商户招募） | `/`                 | ✅   | 顶部登录按钮组（商户/平台）  |
| 店铺页                       | `/shop/:code`       | ✅   | 商品列表/下单                |
| 订单查询                     | `/query`            | ✅   | 邮箱 + 订单号 + 申请退款入口 |
| 模拟支付                     | `/payment/mock-pay` | ✅   | 测试通道                     |
| USDT 支付                    | `/payment/usdt`     | ✅   | QR 码 + 倒计时 + 自动确认    |
| 商户入驻申请                 | `/merchant/apply`   | ✅   | 邮箱验证码即时激活           |
| 忘记密码                     | `/forgot-password`  | ✅   | 图形验证码 + 邮箱码          |

### 2.2 商户工作台 `/merchant/*`（需 MERCHANT 角色）

| 功能       | 路径                        | 状态 | 备注                                        |
| ---------- | --------------------------- | ---- | ------------------------------------------- |
| 数据看板   | `/merchant/dashboard`       | ✅   | 欢迎条 + 4 KPI + 月汇总 + 7 天柱状图 + Top5 |
| 商品管理   | `/merchant/products`        | ✅   | CRUD + 上下架                               |
| 卡密管理   | `/merchant/stock`           | ✅   | CSV 导入 + 状态查询                         |
| 订单管理   | `/merchant/orders`          | ✅   | 全功能                                      |
| API Key    | `/merchant/api-keys`        | ✅   | 创建/吊销（仅显示 keyHint）                 |
| 自定义域名 | `/merchant/domain`          | ✅   | DNS TXT 验证                                |
| 提现结算   | `/merchant/withdrawals`     | ✅   | T+0 + 余额三卡 + 申请弹窗                   |
| 账户设置   | `/merchant/settings`        | ✅   | 主题色 + 修改密码                           |
| 修改密码   | `/merchant/change-password` | ✅   | 通过 settings 跳转                          |

### 2.3 平台后台 `/admin/*`（需 SUPER_ADMIN 角色）

| 功能         | 路径                           | 状态 | 备注                                 |
| ------------ | ------------------------------ | ---- | ------------------------------------ |
| 数据看板     | `/admin/dashboard`             | ✅   | 全平台视角                           |
| 商品管理     | `/admin/products`              | ✅   | SUPER_ADMIN 选店铺                   |
| 卡密管理     | `/admin/stock`                 | ✅   | 跨店铺                               |
| 订单管理     | `/admin/orders`                | ✅   | 全平台                               |
| 支付配置     | `/admin/payments`              | ✅   | 通道启停                             |
| 商户审核     | `/admin/merchant-applications` | ✅   | 通过/拒绝                            |
| API Key      | `/admin/api-keys`              | ✅   | 查看所有                             |
| 自定义域名   | `/admin/domain`                | ✅   | 代理配置                             |
| 行为风控     | `/admin/risk`                  | ✅   | IP/邮箱黑名单 + 熔断                 |
| 高级统计     | `/admin/stats`                 | ✅   | 时段/漏斗/复购/客单价                |
| 审计日志     | `/admin/audit-logs`            | ✅   | 全操作日志                           |
| 系统配置     | `/admin/system`                | ✅   | KV 配置                              |
| 提现审核     | `/admin/withdrawals`           | ✅   | 通过/拒绝/标记已打款                 |
| **退款管理** | **`/admin/refunds`**           | ✅   | **T6 - 通过/拒绝/标记打款/记录失败** |

---

## 3. 后端模块清单（NestJS）

```
apps/api/src/modules/
├── audit-log/          # 审计日志（@Global）
├── auth/                # 登录/Token/忘记密码/密码重置
├── delivery/            # 自动发卡（监听 OrderPaidEvent）
├── health/              # /health 健康检查
├── merchant-application/# 入驻申请 + 邮箱验证码
├── merchant-profile/    # 商户 Profile/主题色/代登录/Dashboard 统计
├── notification/        # 站内信
├── open-api/            # 开放 API（API Key + 商户业务接口）
├── order/               # 订单 CRUD + 统计 + 事件发布
├── payment/             # 支付适配器（epay/mock/usdt）
├── product/             # 商品 CRUD（SUPER_ADMIN 已放宽 merchantId 限制）
├── refund/              # 退款（V4 - 状态机 + 7 天超时 cron + OrderRefundedEvent）
├── risk/                # 风控（@Global，黑名单 + 熔断）
├── shop/                # 店铺 + 自定义域名
├── stats/               # 高级统计
├── stock/               # 卡密 CRUD
└── withdrawal/          # 提现结算（P0 新增）
```

### 3.1 关键 API 端点

| 模块        | 端点                                  | 方法                | 角色        | 说明                                   |
| ----------- | ------------------------------------- | ------------------- | ----------- | -------------------------------------- |
| Auth        | `/api/auth/login`                     | POST                | 公开        | 登录，返回 `defaultRedirect`           |
| Auth        | `/api/auth/refresh`                   | POST                | 公开        | 刷新 Token                             |
| Auth        | `/api/auth/me`                        | POST                | 任意        | 当前用户信息                           |
| Auth        | `/api/auth/captcha`                   | GET                 | 公开        | 图形验证码                             |
| Auth        | `/api/auth/forgot-password/send-code` | POST                | 公开        | 发邮件验证码                           |
| Auth        | `/api/auth/forgot-password/reset`     | POST                | 公开        | 重置密码                               |
| Merchant    | `/api/merchant/apply`                 | POST                | 公开        | 商户入驻申请                           |
| Merchant    | `/api/merchant/apply/send-code`       | POST                | 公开        | 发验证码                               |
| Merchant    | `/api/merchant/profile`               | GET/PUT             | MERCHANT    | 资料/主题色/改密                       |
| Merchant    | `/api/merchant/dashboard/stats`       | GET                 | MERCHANT    | 数据看板                               |
| Withdrawal  | `/api/withdrawal/merchant/balance`    | GET                 | MERCHANT    | 余额                                   |
| Withdrawal  | `/api/withdrawal/merchant/apply`      | POST                | MERCHANT    | 申请提现                               |
| Withdrawal  | `/api/withdrawal/admin/list`          | GET                 | SUPER_ADMIN | 平台列表                               |
| Withdrawal  | `/api/withdrawal/admin/:id/approve`   | POST                | SUPER_ADMIN | 审核通过                               |
| Withdrawal  | `/api/withdrawal/admin/:id/reject`    | POST                | SUPER_ADMIN | 拒绝                                   |
| Withdrawal  | `/api/withdrawal/admin/:id/paid`      | POST                | SUPER_ADMIN | 标记已打款                             |
| Open API    | `/api/open/v1/products`               | GET/POST            | API Key     | 商品 CRUD                              |
| Open API    | `/api/open/v1/stock/import`           | POST                | API Key     | 批量导入                               |
| Open API    | `/api/open/v1/orders`                 | GET                 | API Key     | 订单列表                               |
| Domain      | `/api/admin/shops/:id/domain`         | GET/PUT/POST/DELETE | MERCHANT    | 自定义域名                             |
| Impersonate | `/api/admin/merchants/impersonate`    | POST                | SUPER_ADMIN | 生成代登录 token                       |
| Impersonate | `/api/auth/impersonate/consume`       | POST                | 公开        | 消费代登录 token                       |
| **Refund**  | `/api/refunds/apply`                  | POST                | 公开        | **V4 买家申请退款**                    |
| **Refund**  | `/api/admin/refunds`                  | GET/POST            | SUPER_ADMIN | **V4 平台代发/列表**                   |
| **Refund**  | `/api/admin/refunds/:id/approve`      | POST                | SUPER_ADMIN | **V4 审核通过**                        |
| **Refund**  | `/api/admin/refunds/:id/reject`       | POST                | SUPER_ADMIN | **V4 拒绝**                            |
| **Refund**  | `/api/admin/refunds/:id/mark-paid`    | POST                | SUPER_ADMIN | **V4 标记打款 (manualPayout/tradeNo)** |
| **Refund**  | `/api/admin/refunds/:id/mark-failed`  | POST                | SUPER_ADMIN | **V4 通道退款失败**                    |

**完整 Swagger 文档**：https://winmelon.cn/api/docs

---

## 4. 前端结构（Vue 3）

```
apps/web/src/
├── views/
│   ├── Home.vue                    # 首页（带登录入口）
│   ├── ForgotPassword.vue          # 忘记密码
│   ├── shop/                       # 买家侧
│   │   ├── ShopIndex.vue
│   │   ├── OrderQuery.vue          # V4 申请退款按钮 + 弹窗
│   │   ├── MockPay.vue
│   │   ├── UsdtPay.vue
│   │   └── MerchantApply.vue
│   ├── admin/                      # 平台后台
│   │   ├── Login.vue
│   │   ├── Layout.vue              # 改版：深色侧栏 + 白色顶栏
│   │   ├── Dashboard.vue
│   │   ├── Products.vue            # admin 选店铺
│   │   ├── Stock.vue
│   │   ├── Orders.vue
│   │   ├── Payments.vue
│   │   ├── SystemConfig.vue
│   │   ├── MerchantApplications.vue
│   │   ├── ShopDomain.vue
│   │   ├── AuditLog.vue
│   │   ├── AdvancedStats.vue
│   │   ├── RiskControl.vue
│   │   ├── ApiKeys.vue
│   │   ├── Withdrawals.vue         # 提现审核
│   │   └── Refunds.vue             # V4 退款管理
│   └── merchant/                    # 商户工作台
│       ├── MerchantLayout.vue       # 改版：深色侧栏 + 白色顶栏
│       ├── MerchantDashboard.vue
│       ├── Withdrawals.vue          # 提现申请
│       ├── MerchantSettings.vue
│       └── ImpersonateConsume.vue
├── stores/auth.ts                  # 用户登录态 + 角色 + 主题色
├── api/http.ts                      # axios + JWT 注入
└── router/index.ts                  # 双前缀路由 + 角色守卫
```

---

## 5. 数据库表（Prisma Schema）

```
User           # 用户（含 SUPER_ADMIN/MERCHANT/STAFF 三种角色）
Merchant       # 商户（balance/freezeBalance/totalWithdrawn/themeColor）
Shop           # 店铺（customDomain/domainVerified/domainVerifyToken）
Product        # 商品
ProductCategory# 商品分类
StockCard      # 卡密（AES-256-GCM 加密，orderId 唯一）
Order          # 订单
OrderItem      # 订单项
Payment        # 支付记录（含 usdtWallet/usdtAmount/usdtTxHash/expiresAt）
PaymentChannel # 支付通道（epay/mock/usdt）
SystemConfig   # KV 系统配置
AuditLog       # 审计日志
IpBlacklist    # IP 黑名单
EmailBlacklist # 邮箱黑名单
RiskRecord     # 风控记录
MerchantApplication  # 商户入驻申请
EmailVerification    # 验证码（6位，type=reset_password/merchant_apply）
ApiKey         # 开放 API Key
Withdrawal      # 提现申请（P0 新增）
Refund          # V4 退款申请（5 状态机 + merchantId 反范式 + 通道字段）
CommissionRecord# 邀请返佣记录（V4 加 reversedAt 字段，支持冲正）
```

---

## 6. 部署信息

| 项       | 值                                                         |
| -------- | ---------------------------------------------------------- |
| 域名     | https://winmelon.cn                                        |
| API 域名 | https://winmelon.cn/api                                    |
| Swagger  | https://winmelon.cn/api/docs                               |
| 服务器   | 香港 162.251.93.5（用户私有）                              |
| 架构     | Docker Compose（api/web/mysql/redis）+ Nginx 混合部署      |
| 容器     | wm-card-api-prod / wm-card-mysql-prod / wm-card-redis-prod |
| 前端     | Baota Nginx + /www/wwwroot/winmelon.cn                     |
| HTTPS    | Cloudflare Origin CA                                       |
| 邮箱     | QQ SMTP（1660069758@qq.com），已修复 MAIL_PORT 类型问题    |

---

## 7. 待办 Roadmap（按优先级）

### 7.1 V4 退款（阶段 1 已完成，阶段 2 待实施）

| ID   | 任务                       | 状态    | 备注                                                       |
| ---- | -------------------------- | ------- | ---------------------------------------------------------- |
| V4-1 | Refund 数据模型 + 迁移 SQL | ✅ 完成 | T1 - 5 状态机 + merchantId 反范式                          |
| V4-2 | 退款状态机 + 7 天超时 cron | ✅ 完成 | T2 - markPaid 事务 + PENDING 超时自动 REJECTED             |
| V4-3 | 阶段 1 退款逻辑            | ✅ 完成 | T4 - 余额扣减 + 卡密重置 + 事件发出                        |
| V4-4 | 返佣冲正                   | ✅ 完成 | T5 - OrderRefundedEvent 监听 + CommissionRecord.reversedAt |
| V4-5 | 退款前端（买家 + 平台）    | ✅ 完成 | T6 - OrderQuery.vue 申请按钮 + Refunds.vue 列表            |
| V4-6 | 阶段 2 实际退钱通道        | ⏳ 待办 | **T3** - 易支付/微信/支付宝 adapter + USDT 手动打款        |
| V4-7 | 财务对账页                 | ⏳ 待办 | `/admin/finance/daily-report`                              |

### 7.2 P0（核心运营功能）

| ID   | 任务             | 状态    | 备注                                            |
| ---- | ---------------- | ------- | ----------------------------------------------- |
| P0-1 | 提现结算 - 后端  | ✅ 完成 | T+0，5 个端点                                   |
| P0-2 | 提现结算 - 前端  | ✅ 完成 | 商户申请 + 平台审核两页                         |
| P0-3 | 生意罗盘 UV/转化 | ⏳ 待办 | PageView 表 + IP+UA 短窗口去重 + Dashboard 扩展 |

### 7.2 P1（重要但非核心）

| ID   | 任务                | 状态    | 备注                                             |
| ---- | ------------------- | ------- | ------------------------------------------------ |
| P1-1 | 平台公告            | ⏳ 待办 | Article 表 + 平台发布 + 店铺页显示（免责声明等） |
| P1-2 | 商户选择支付通道    | ⏳ 待办 | MerchantPaymentChannel 表 + 启/禁                |
| P1-3 | 微信/支付宝官方支付 | ⏳ 暂缓 | 等用户有商户号再做                               |

### 7.3 P2（业务增强）

| ID       | 任务              | 状态    | 备注                                                       |
| -------- | ----------------- | ------- | ---------------------------------------------------------- |
| P2-1     | 单层邀请码 + 返佣 | ⏳ 待办 | 平台自定义返佣比例，来源为商户利润                         |
| P2-2     | 投诉/工单         | ⏳ 待办 | 买家→平台→商户三方对话 + 24h 自动退款 + 多次未响应自动冻结 |
| P2-3     | 站内信            | ⏳ 待办 | 轮询（30s）+ 邮件代发                                      |
| ~~P2-4~~ | ~~优惠券~~        | ❌ 不做 | 用户判断为鸡肋功能                                         |

---

## 8. 已知问题与修复记录

### 8.1 已修复

| 问题                                     | 修复 commit | 根因                                                                                    |
| ---------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| 验证码邮件发送失败                       | `0c80bc4`   | `MAIL_PORT` 在 .env 是字符串 `"465"`，`secure: port === 465` 比较失败导致 STARTTLS 模式 |
| Docker 构建 Prisma Client 缺模型         | `6f34df5`   | Builder 容器内 `prisma generate` 输出不完整，预生成 + `--ignore-scripts`                |
| 商户登录后能看平台后台所有数据           | `a16f253`   | 双前缀路由 + 角色守卫 + SUPER_ADMIN 不受限                                              |
| admin 创建商品触发"无权操作该店铺"       | `0abace2`   | SUPER_ADMIN 反查真实 shopId，移除 merchantId 限制                                       |
| API 容器 main.js 每次 build 都被旧版覆盖 | 临时        | `app.get(ShopHostMiddleware)` → `new ShopHostMiddleware(prisma)` 直接实例化             |

### 8.2 已知小问题（未处理）

- **main.js 旧版覆盖问题**：每次全量 build 都会出现，需要 build 后手动 cp 覆盖。可考虑在 Dockerfile 加 `chmod -R` 或专门的 post-build 步骤
- **前端 .vue.js 编译产物**已清理，但需要在每次新功能前检查是否有遗漏的 `.js` 编译产物
- **退款阶段 2 实际退钱通道（T3）尚未实施**：当前 `mark-paid manualPayout=true` 仅记录状态，实际退款金额需 SUPER_ADMIN 线下打款

---

## 9. 部署与运维

### 9.1 部署命令

```bash
# 本地编译后端
cd D:/soft/wm-card
npx --workspace @wm-card/api nest build

# 重新生成 Prisma Client（schema 变更后）
cd apps/api && npx prisma generate
bash deploy/scripts/prepare-prebuilt-prisma.sh

# 上传 + 构建
tar -czf /tmp/api.tar.gz apps/api/src apps/api/prebuilt-prisma
scp /tmp/api.tar.gz root@162.251.93.5:/tmp/
ssh root@162.251.93.5 "cd /opt/wm-card && tar -xzf /tmp/api.tar.gz && docker compose -f docker-compose.prod.yml build --no-cache api"

# 应用 SQL 迁移
scp sql/file.sql root@162.251.93.5:/tmp/
ssh root@162.251.93.5 "docker exec -i wm-card-mysql-prod mysql -uroot -p\$(grep MYSQL_ROOT_PASSWORD /opt/wm-card/.env | cut -d= -f2) < /tmp/file.sql"

# 重启 API
ssh root@162.251.93.5 "cd /opt/wm-card && docker compose -f docker-compose.prod.yml up -d --force-recreate api"

# 修复 main.js 旧版（临时）
npx --workspace @wm-card/api nest build
scp apps/api/dist/main.js root@162.251.93.5:/tmp/main.new.js
ssh root@162.251.93.5 "docker cp /tmp/main.new.js wm-card-api-prod:/app/apps/api/dist/main.js && docker restart wm-card-api-prod"

# 部署前端
cd apps/web && npx vite build
tar -czf /tmp/web.tar.gz -C dist .
scp /tmp/web.tar.gz root@162.251.93.5:/tmp/
ssh root@162.251.93.5 "rm -rf /www/wwwroot/winmelon.cn/* && tar -xzf /tmp/web.tar.gz -C /www/wwwroot/winmelon.cn/"
```

### 9.2 容器健康

```bash
ssh root@162.251.93.5 "docker ps | grep wm-card"
ssh root@162.251.93.5 "docker logs wm-card-api-prod --tail 50"
```

### 9.3 备份

```bash
ssh root@162.251.93.5 "bash /opt/wm-card/deploy/scripts/backup.sh"
# 或 MySQL 单独备份
ssh root@162.251.93.5 "docker exec wm-card-mysql-prod mysqldump -uroot -p\$(grep MYSQL_ROOT_PASSWORD /opt/wm-card/.env | cut -d= -f2) wmcard > /tmp/wmcard-\$(date +%Y%m%d).sql"
```

---

## 10. 后续工程师接手指南

### 10.1 第一次打开项目

1. 读 `README.md` → 了解项目定位
2. 读 `ARCHITECTURE.md` → 了解整体架构
3. 读本文件（`PROJECT-STATUS.md`）→ 了解当前状态
4. 读 `SECURITY-BASELINE.md` → 了解安全约束

### 10.2 开发新功能的标准流程

1. **检查现有模块**：在 `apps/api/src/modules/` 和 `apps/web/src/views/` 中搜索类似功能
2. **后端**：
   - 数据库变更 → `apps/api/prisma/schema.prisma` + `npx prisma generate` + `bash deploy/scripts/prepare-prebuilt-prisma.sh`
   - 新建模块：`module-name/` + `service.ts` + `controller.ts` + `module.ts`
   - 注册到 `app.module.ts`
   - 加审计日志（如涉及状态变更）
3. **前端**：
   - 新页面：放在 `views/{admin|merchant|shop}/`
   - 新路由：编辑 `apps/web/src/router/index.ts`
   - 加菜单项：编辑 `Layout.vue`
   - API 调用：使用 `api/http.ts` 的 `get/post/put/del`
4. **数据库迁移**：
   - 写 SQL 到 `deploy/sql/` 描述文件名（如 `withdrawals.sql`）
   - 应用到服务器：`docker exec -i wm-card-mysql-prod mysql ... < file.sql`
5. **部署**：见 9.1 部署命令

### 10.3 常用调试技巧

- **后端日志**：`docker logs wm-card-api-prod --tail 100 -f`
- **查看 Prisma 生成的 SQL**：在 service 中临时加 `this.prisma.$on('query', e => console.log(e.query, e.params))`
- **测试 API**：用 `curl` + JSON 文件 + admin token
- **前端调试**：浏览器 DevTools + Vue DevTools 插件

### 10.4 项目记忆（自动维护）

Claude Code 在每个会话都会加载以下项目记忆（参见 `~/.claude/projects/.../memory/MEMORY.md`）：

- `project_wm_card.md` - WM 项目背景
- `project_deployment.md` - 部署信息
- `feedback_tech_stack.md` - 技术栈约束
- `feedback_self_test_build.md` - 改完代码后自己编译测试
- `feedback_ssh_tunnel_first.md` - 反代/隧道场景优先沿用现有架构
- `feedback_collab_style.md` - 协作模式（用户喜欢"给推荐+让他执行"）

---

## 11. 联系方式

- 项目维护者：用户本人（项目负责人，全栈开发）
- Claude Code 协作方式：对话式开发，文档工程师 + 全栈开发结合

---

**下次更新时机**：每完成 P0/P1/P2 任一任务时同步更新本文档的"待办 Roadmap"和"已实现功能矩阵"部分。
