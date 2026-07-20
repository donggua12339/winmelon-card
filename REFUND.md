# 退款功能设计与实现

> 修订日期：2026-07-15
> 状态：T1-T6 + T3 阶段 2（mock 通道 + 强制覆盖）已上线；epay/usdt 通道已实现但需真实商户凭证验证

## 一、目标

让买家能就卡密问题申请退款，平台审核通过后自动：

- 退款金额原路退回（易支付/微信/支付宝/mock 通道）
- 撤销返佣（已邀请的二级分销返佣同步冲正）
- 商户余额扣减（允许 -¥1000 硬下限，admin 可强制覆盖）
- 关联卡密 SOLD → AVAILABLE 重置（仅当卡密未被查看）

## 二、状态机

```
        buyer / platform                SUPER_ADMIN                SUPER_ADMIN
            │                              │                            │
            ▼                              ▼                            │
       ┌─────────┐   approve        ┌──────────┐   mark-paid         │
       │ PENDING │ ───────────────▶ │ APPROVED │ ───────────────┐    │
       └─────────┘                  └──────────┘                ▼    │
            │                            │                  ┌─────────┐
            │ reject                     │ mark-failed      │  PAID   │
            │                            ▼                  └─────────┘
            │                       ┌─────────┐
            │                       │ FAILED  │  (3 次重试)
            │                       └─────────┘
            ▼
       ┌──────────┐
       │ REJECTED │  (含 7 天超时自动拒绝)
       └──────────┘
```

| 状态       | 进入方式                              | 可转出状态            |
| ---------- | ------------------------------------- | --------------------- |
| `PENDING`  | 买家 / 平台创建退款申请               | `APPROVED`/`REJECTED` |
| `APPROVED` | SUPER_ADMIN 审核通过                  | `PAID`/`FAILED`       |
| `REJECTED` | SUPER_ADMIN 拒绝 / 7 天超时自动拒绝   | 终态                  |
| `PAID`     | `mark-paid` 阶段 1+2 完成（事务原子） | 终态                  |
| `FAILED`   | 通道退款失败（`retryCount` ≤ 3）      | `PAID`（重试成功）    |

## 三、关键业务规则

### 3.1 退款前置约束（Q13 决策 a）

- **仅 `PAID` / `DELIVERED` 订单可申请退款**
- **`viewed_at` 有值 → 拒绝**（"确认收货"性质，需 SUPER_ADMIN 人工处理）
  - 避免：买家查看卡密后再以"未收到"为由退款
  - API 层在 `create()` 阶段直接抛 `ForbiddenException`（HTTP 403）

### 3.2 幂等性

- 同一订单已有 `PENDING` / `APPROVED` 退款 → 抛 `BadRequestException`
- 同一订单 `PAID` 终态允许继续走"补退款"流程（实为全额退款，不重复扣款）

### 3.3 商户余额硬下限（Q11 决策 b）

- 允许商户余额为负（-¥1000 内）
- 退款使余额低于 -¥1000 → 抛 `BadRequestException` 提示"需 SUPER_ADMIN 强制覆盖"
- 强制覆盖路径：**T3 实施后**将增加 admin 端勾选框绕过此检查

### 3.4 返佣冲正（Q12 决策 a）

- 监听 `OrderRefundedEvent`（由 `refund.service.ts markPaid` 事务外发出）
- `invite.service.ts handleOrderRefunded` 接收事件
- 事务内：
  - 查找 `commission_records` 中该订单的 `CONFIRMED` 记录
  - 状态改为 `REVERSED`，`reversedAt = now`
  - 邀请人余额扣减
  - 来源商户余额 `increment`（返还商户）
- 允许邀请人余额变负（与商户余额规则一致）

### 3.5 卡密重置

- 仅 `viewed_at === null` 的订单能走 `markPaid`
- 关联卡密（SOLD 状态）批量：`status='AVAILABLE', orderId=null, soldAt=null`
- 重新回到库存池，可被后续订单消费

### 3.6 7 天超时（Q17 决策 b）

- 每 10 分钟 cron 扫描 `PENDING` 且 `createdAt < now - 7d` 的退款
- 自动 `REJECTED`，`rejectReason = "超 7 天未审核，系统自动拒绝"`
- 记 audit log（`actorId='system'`）

## 四、API 设计

### 4.1 买家侧（公开）

```http
POST /api/refunds/apply
Content-Type: application/json

{
  "orderNo": "335664774551441408",
  "buyerEmail": "t6-test@example.com",
  "reason": "支付成功但未收到卡密"
}

→ 200 { "id": "uuid", "refundNo": "335673000034570240", "status": "PENDING" }
```

- `@Public()` - 公开端点，双因子校验（订单号 + 邮箱）
- 与 `/api/orders/query` 一致的安全模型

### 4.2 平台侧（SUPER_ADMIN）

```http
POST /api/admin/refunds                  # 平台代发起退款
POST /api/admin/refunds/:id/approve      # 审核通过
POST /api/admin/refunds/:id/reject       # 拒绝 { rejectReason }
POST /api/admin/refunds/:id/mark-paid    # 标记打款 { manualPayout?, tradeNo? }
POST /api/admin/refunds/:id/mark-failed  # 通道退款失败 { error }
GET  /api/admin/refunds                  # 列表 (page/pageSize/status/merchantId)
```

`mark-paid` 两种模式：

- **`manualPayout: true`** - 线下手动打款（USDT / 微信好友转账等），无需 `tradeNo`
- **`manualPayout: false`** - 通道原路退款：
  - 不传 `tradeNo` → 自动调 `PaymentService.refundChannel()` 走通道 API
  - 传 `tradeNo` → admin 已通过其他渠道退过，标记已退
- **`forceOverride: true`**（可选）- 商户余额将 < -¥1000 时强制覆盖（仅 SUPER_ADMIN 用）

## 五、数据模型

```prisma
model Refund {
  id            String   @id @default(uuid())
  refundNo      String   @unique                // 雪花 ID
  orderId       String
  merchantId    String?                         // 反范式，便于查询
  amount        Decimal  @db.Decimal(12, 2)
  reason        String   @db.VarChar(500)
  status        RefundStatus                     // PENDING/APPROVED/REJECTED/PAID/FAILED
  initiator     RefundInitiator                  // BUYER/PLATFORM
  processedById String?
  processedAt   DateTime?
  rejectedAt    DateTime?
  rejectReason  String?
  paidAt        DateTime?
  tradeNo       String?                          // 通道退款流水号
  retryCount    Int      @default(0)             // 通道失败重试
  lastError     String?  @db.Text
  manualPayout  Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  order         Order    @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@index([status, createdAt])   // cron 扫描用
  @@index([merchantId, status])  // 商户维度列表
}
```

`commission_records` 表加 `reversedAt: DateTime?` 字段。

## 六、事务边界（P1-8 修复模式）

`markPaid()` 是关键路径，事务边界：

```
BEGIN TX
  1. Refund → PAID
  2. Order → REFUNDED
  3. Merchant.balance -= amount  (with -¥1000 floor check)
  4. StockCard → AVAILABLE       (where orderId=X AND status='SOLD')
COMMIT

[事务外]
  5. emit OrderRefundedEvent     (供 invite.service 监听)
  6. audit log record
```

事件在事务外发送，避免：

- 事务回滚但事件已发送 → 返佣已冲正但退款未完成（数据不一致）
- 事务未提交但事件已发送 → invite 监听器查不到 ref record

## 七、阶段 2 实际退钱通道（2026-07-15 已实施）

### 7.1 Adapter 接口扩展

`PaymentAdapter` 接口加 `refund(params, config): Promise<RefundResult>` 方法。

### 7.2 各通道实现

| 通道     | refund 实现                                       | 备注                                      |
| -------- | ------------------------------------------------- | ----------------------------------------- |
| **mock** | 直接返回成功 + `MOCK_REFUND_<refundNo>`           | 完整 E2E 测试用，**已 E2E 通过**          |
| **epay** | POST `${apiDomain}/api.php?act=refund` + MD5 签名 | 需真实易支付商户凭证（pid/key/apiDomain） |
| **usdt** | 抛 "请使用 manualPayout=true 由 admin 手动打款"   | 链上交易无法由通道 API 触发原路退回       |

### 7.3 编排（PaymentService.refundChannel）

```
1. 查原 Payment 记录（取 channel + tradeNo）
2. 加载通道配置
3. 调 adapter.refund()
4. 返回 { tradeNo, channel } → 写入 Refund.tradeNo
```

### 7.4 失败处理

- 通道 refund 失败 → 抛 BadRequestException → 退款单保持 APPROVED
- admin 可重试，或改 manualPayout=true 走线下

### 7.5 财务对账页

- ⏳ 待实施：`/admin/finance/daily-report`
- 数据源：Refund + Order + Merchant 表的 JOIN，按日期聚合
- 导出 CSV

## 八、相关文件

- `apps/api/src/modules/refund/refund.service.ts` - 状态机 + 业务规则
- `apps/api/src/modules/refund/refund.controller.ts` - 7 个端点
- `apps/api/src/modules/refund/refund.module.ts` - 模块声明
- `apps/api/src/modules/order/events/order-refunded.event.ts` - 退款事件定义
- `apps/api/src/modules/invite/invite.service.ts` - `handleOrderRefunded` 监听器
- `apps/api/prisma/schema.prisma` - Refund 模型 + enums
- `deploy/sql/2026-07-15-refund-tables.sql` - SQL 迁移
- `apps/web/src/views/shop/OrderQuery.vue` - 买家侧申请按钮 + 弹窗
- `apps/web/src/views/admin/Refunds.vue` - 平台侧列表 + 审核
- `apps/web/src/views/admin/Layout.vue` - 菜单加"退款管理"
