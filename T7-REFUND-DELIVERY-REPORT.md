# V4 退款功能交付报告（T1-T7 + 部署）

> 日期：2026-07-15
> 状态：✅ 全部完成，线上运行中（epay/usdt 需真实商户凭证验证）

---

## 一、本轮完成清单

| ID     | 任务                        | 状态    | 备注                                                            |
| ------ | --------------------------- | ------- | --------------------------------------------------------------- |
| **T1** | Refund schema + 迁移 SQL    | ✅ 完成 | `Refund` 模型 + 2 enums + commission_records.reversedAt         |
| **T2** | Refund 状态机 + 7 天超时    | ✅ 完成 | 5 状态机 + 10min cron 自动 REJECTED                             |
| **T3** | 阶段 2 实际退钱通道         | ✅ 完成 | mock 通道 E2E 通过 + epay/usdt adapter 已实现                   |
| **T4** | 阶段 1 退款逻辑（事务原子） | ✅ 完成 | 余额扣减 + 卡密重置 + OrderRefundedEvent                        |
| **T5** | 返佣冲正                    | ✅ 完成 | invite.service 监听事件 + CommissionRecord REVERSED             |
| **T6** | 退款前端（买家 + 平台）     | ✅ 完成 | OrderQuery.vue 申请按钮 + Refunds.vue 列表 + forceOverride 重试 |
| **T7** | 文档 + 验收                 | ✅ 完成 | REFUND.md + PROJECT-STATUS 更新 + 本报告                        |

附带的清理：

- ✅ nginx `/graphql` 反代移除（GraphQL 模块已整体删除）
- ✅ vue-tsc pre-existing TS 错误全部修复（13 个 → 0）
- ✅ Bug fix: `/refunds/apply` 缺 `@Public()` 装饰器

---

## 二、E2E 验证（生产环境）

**测试订单**: `335664774551441408` (¥1.00, PAID, viewedAt=null, shop=dongua16600)

| 步骤 | 端点                                | 期望          | 实际                                      | 结果 |
| ---- | ----------------------------------- | ------------- | ----------------------------------------- | ---- |
| 1    | `POST /refunds/apply`               | 200, PENDING  | 200, refundNo=335673000034570240, PENDING | ✅   |
| 2    | `GET /admin/refunds`                | 列表含此条    | items=2（包含新 PENDING）                 | ✅   |
| 3    | `POST /admin/refunds/:id/approve`   | 200, APPROVED | 200, status=APPROVED                      | ✅   |
| 4    | `POST /admin/refunds/:id/mark-paid` | 200, PAID     | 200, status=PAID, manualPayout=1          | ✅   |

**副作用验证（DB）**:

- ✅ Order: status `REFUNDED`, viewedAt 仍 NULL
- ✅ Refund: status `PAID`, manualPayout=1, paidAt=2026-07-15 06:45:11
- ✅ StockCard: 该 orderId 下无 SOLD 卡密（已重置为 AVAILABLE, orderId=NULL）

**历史订单 viewedAt 拒绝验证**:

- 测试订单 334613242649251840 (viewedAt=2026-07-12 08:34:07)
- `POST /refunds/apply` → 403 "买家已查看卡密，需 SUPER_ADMIN 人工处理退款" ✅

**状态守卫验证**:

- REFUNDED 订单再次 `POST /refunds/apply` → 400 "订单状态 REFUNDED 不支持退款" ✅
- PAID 退款再次 `POST /admin/refunds/:id/mark-paid` → 400 "退款状态 PAID 不能标记打款" ✅

---

## 三、关键设计决策

| 决策               | 选项                             | 理由                                                   |
| ------------------ | -------------------------------- | ------------------------------------------------------ |
| Q11 商户余额下限   | -¥1000 硬下限                    | 防止恶意刷单；1000 内可控，超过需 SUPER_ADMIN 强制覆盖 |
| Q12 返佣冲正时序   | 事务外发事件                     | 避免事务回滚但事件已发（数据不一致）                   |
| Q13 viewed_at 拒绝 | 拒绝自动退款                     | 卡密已被查看说明已"确认收货"，需人工                   |
| Q17 超时处理       | 7 天自动 REJECTED                | 防止退款申请无限期挂起；自动记 audit log               |
| Q19 退款金额校验   | `0 < amount ≤ order.totalAmount` | 防止金额篡改                                           |
| Q20 幂等性         | 同一订单仅 1 个 PENDING/APPROVED | 防止重复扣款                                           |

完整决策链见 `/nox-grill-me` 会话记录。

---

## 四、API 变更摘要

**新增端点（7 个）**:

- `POST /api/refunds/apply` - 买家申请退款（公开，双因子）
- `POST /api/admin/refunds` - 平台代发起退款
- `GET /api/admin/refunds` - 退款列表
- `POST /api/admin/refunds/:id/approve` - 审核通过
- `POST /api/admin/refunds/:id/reject` - 拒绝退款
- `POST /api/admin/refunds/:id/mark-paid` - 标记打款（manualPayout/tradeNo）
- `POST /api/admin/refunds/:id/mark-failed` - 通道退款失败

**Schema 变更**:

- `Refund` 新表（19 字段 + 3 索引）
- `commission_records.reversedAt` 字段新增
- `Order.refunds` 反向关系

**前端变更**:

- `views/shop/OrderQuery.vue` - 加 viewedAt 字段、申请退款按钮、原因弹窗
- `views/admin/Refunds.vue` - 新增（列表 + 4 种操作）
- `views/admin/Layout.vue` - 菜单加"↩️ 退款管理"
- `router/index.ts` - 加 `/admin/refunds` 路由

---

## 五、剩余工作

### 阶段 2 通道（mock 已 E2E，epay/usdt 待真实凭证）

| 通道           | 优先级 | 依赖                           | 状态                |
| -------------- | ------ | ------------------------------ | ------------------- |
| **mock**       | P0     | 无（已实现）                   | ✅ E2E 通过         |
| **易支付**     | P0     | 需真实 pid/key/apiDomain       | 🟡 代码完成，待凭证 |
| **USDT**       | P1     | manualPayout 流程              | ✅ 抛错让走手动     |
| 微信官方       | P1     | 需商户号                       | 暂缓                |
| 支付宝官方     | P1     | 需商户号                       | 暂缓                |
| **财务对账页** | P0     | 数据来自 Refund+Order+Merchant | ⏳ 待实施           |

### 监控告警（建议）

- PENDING 退款 > 24h → 邮件提醒
- FAILED 退款 retryCount=3 → 通知 SUPER_ADMIN 介入
- 商户余额接近 -¥1000 → 风控告警

---

## 六、相关文件索引

**后端**:

- `apps/api/src/modules/refund/refund.service.ts` (核心逻辑, 430 行)
- `apps/api/src/modules/refund/refund.controller.ts` (7 端点)
- `apps/api/src/modules/refund/refund.module.ts`
- `apps/api/src/modules/order/events/order-refunded.event.ts`
- `apps/api/src/modules/invite/invite.service.ts` (`handleOrderRefunded` 监听器)
- `apps/api/prisma/schema.prisma` (Refund 模型)
- `deploy/sql/2026-07-15-refund-tables.sql` (迁移 SQL)
- `apps/api/src/app.module.ts` (RefundModule 注册)

**前端**:

- `apps/web/src/views/shop/OrderQuery.vue` (申请按钮 + 弹窗)
- `apps/web/src/views/admin/Refunds.vue` (列表 + 4 操作)
- `apps/web/src/views/admin/Layout.vue` (菜单项)
- `apps/web/src/router/index.ts` (`/admin/refunds` 路由)

**部署**:

- API 镜像: `wm-card-prod-api:504519d1a0bd`
- Web dist: 99 文件已上传到 `/www/wwwroot/winmelon.cn/`
- 容器: `wm-card-api-prod` (healthy)
- nginx `/graphql` 反代已移除

**文档**:

- `REFUND.md` - 退款功能详细文档
- `PROJECT-STATUS.md` - 更新至 V4 状态
- `T7-REFUND-DELIVERY-REPORT.md` - 本报告
