# T3 + V4-7 交付报告

> 日期：2026-07-15
> 部署状态：线上已运行（API 镜像 `2ff44ab353a9`，web 99 文件已上传）
> 范围：退款阶段 2 实际退钱 + 财务对账页

---

## 一、本次交付功能

| ID     | 功能                     | 状态 | 备注                                                                                                 |
| ------ | ------------------------ | ---- | ---------------------------------------------------------------------------------------------------- |
| T3-1   | Refund schema 扩展       | ✅   | 6 字段：lastErrorAt / nextRetryAt / alertSentAt / usdtTxHash / usdtSenderWallet / usdtReceiverWallet |
| T3-2   | epay/mock/usdt refund()  | ✅   | epay 真实调 API + mock 模拟 + usdt 抛 NotSupportedError                                              |
| T3-3   | RefundService 状态机升级 | ✅   | retryRefund + markFailed 设 nextRetryAt                                                              |
| T3-4   | 重试 Cron + 严重告警     | ✅   | 每分钟扫，1m/5m/30m 指数退避，耗尽发站内信+邮件                                                      |
| T3-5   | admin Refunds.vue 升级   | ✅   | USDT 手动打款表单（txHash + wallets）+ 立即重试按钮                                                  |
| V4-7-1 | 财务对账页               | ✅   | 日表 + 按通道 + 按商户 + CSV 导出                                                                    |
| V4-7-2 | 容差阈值配置             | ✅   | system_configs.finance_tolerance_yuan，默认 ¥1                                                       |
| V4-7-3 | 对账 Cron + 告警         | ✅   | 每小时扫；超容差写 log + 1h 去重发信                                                                 |
| V4-7-4 | 告警列表 + 解决          | ✅   | 标记解决 + 解决备注                                                                                  |

---

## 二、数据库变更

**新增 1 张表**（迁移 SQL：`deploy/sql/2026-07-15-t3-v47-migration.sql`）：

- `finance_reconciliation_logs`：财务对账差异日志（id / snapshotAt / type / description / diffAmount / severity / notifiedAt / resolved / resolvedAt / resolvedBy / resolutionNote）

**修改 1 张表**：

- `refunds` 加 6 字段（lastErrorAt / nextRetryAt / alertSentAt / usdtTxHash / usdtSenderWallet / usdtReceiverWallet）
- `refunds` 加索引 `idx_refunds_status_nextRetryAt (status, nextRetryAt)` 加速重试扫描

---

## 三、关键设计决策

### T3 退款退避

| retryCount | nextRetryAt | 说明                      |
| ---------- | ----------- | ------------------------- |
| 1          | now + 1min  | 第 1 次失败后 1 分钟重试  |
| 2          | now + 5min  | 第 2 次失败后 5 分钟重试  |
| 3          | now + 30min | 第 3 次失败后 30 分钟重试 |
| ≥3         | null        | 停止自动重试，转人工      |

### T3 严重告警去重

- 同 refund 1 小时内最多发 1 次告警（`alertSentAt` 时间戳判断）
- 告警目标：所有 `role=SUPER_ADMIN` 且 `isActive=true` 的用户
- 渠道：站内信 + 邮件

### V4-7 对账恒等式

理论恒等：`总收入 - 总退款 = 商户余额合计 + 提现合计`

实际计算时考虑：

- `payments.amount` where `status=SUCCESS`（按 paidAt 聚合）
- `refunds.amount` where `status=PAID`（按 paidAt 聚合）
- `merchants.balance` 实时余额合计
- `withdrawals.amount` where `status=PAID` 历史累计

差异 > 容差 → 写 `finance_reconciliation_logs` + 告警。

### V4-7 容差阈值

- 存储：`system_configs.finance_tolerance_yuan`
- 默认：¥1（小额差异容忍）
- 调整：通过 `POST /api/admin/finance/tolerance?yuan=N` 设置

---

## 四、API 端点

### T3 退款

| 方法     | 路径                                 | 角色            | 说明                                        |
| -------- | ------------------------------------ | --------------- | ------------------------------------------- |
| POST     | `/api/refunds/apply`                 | 公开            | 买家申请退款（订单号+邮箱双因子）           |
| POST     | `/api/admin/refunds`                 | SUPER_ADMIN     | 平台发起退款                                |
| POST     | `/api/admin/refunds/:id/approve`     | SUPER_ADMIN     | 审核通过                                    |
| POST     | `/api/admin/refunds/:id/reject`      | SUPER_ADMIN     | 拒绝                                        |
| POST     | `/api/admin/refunds/:id/mark-paid`   | SUPER_ADMIN     | 标记打款（支持 manualPayout + usdt 三件套） |
| POST     | `/api/admin/refunds/:id/mark-failed` | SUPER_ADMIN     | 记录失败（自动 +1 retryCount）              |
| **POST** | **`/api/admin/refunds/:id/retry`**   | **SUPER_ADMIN** | **手动重试（新增）**                        |
| GET      | `/api/admin/refunds`                 | SUPER_ADMIN     | 列表                                        |

### V4-7 财务对账

| 方法 | 路径                                             | 说明                           |
| ---- | ------------------------------------------------ | ------------------------------ |
| GET  | `/api/admin/finance/daily-report?days=7`         | 多维度报告（日 + 通道 + 商户） |
| GET  | `/api/admin/finance/tolerance`                   | 当前容差                       |
| POST | `/api/admin/finance/tolerance?yuan=N`            | 设置容差                       |
| GET  | `/api/admin/finance/alerts`                      | 告警列表                       |
| POST | `/api/admin/finance/alerts/:id/resolve?note=...` | 标记解决                       |
| GET  | `/api/admin/finance/export?days=7`               | CSV 导出（带 BOM）             |

---

## 五、UI 页面

### T3 admin Refunds.vue

- 表格列新增：`打款方式` / `重试 (n/3)` / `最近失败`
- 操作按钮按状态分流：
  - `PENDING`：通过 / 拒绝
  - `APPROVED`：通道退款 / USDT 手动
  - `FAILED`：立即重试（retryCount<3）/ 转 USDT 手动
- USDT 手动打款弹窗：txHash + senderWallet + receiverWallet 三件套

### V4-7 FinanceDailyReport.vue

- 4 个汇总卡（总收入/总退款/净收入/退款率）
- 7/14/30 天切换
- 容差阈值按钮（一键调整）
- 三个表（日表 + 按通道 + 按商户）
- CSV 导出按钮

### V4-7 FinanceAlerts.vue

- 列表：严重度 / 类型 / 差异金额 / 描述 / 告警时间 / 状态
- 开关：未解决 / 已解决
- 操作：标记解决（备注）

---

## 六、E2E 验收

| 验证项                           | 命令                                      | 结果                                                 |
| -------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| 迁移成功                         | `mysql < 2026-07-15-t3-v47-migration.sql` | ✅ 6 refund cols + 1 finance_logs                    |
| API 启动                         | `curl /api/health`                        | ✅ `{"status":"ok","db":"ok","redis":"ok"}`          |
| 财务 daily-report                | `GET /admin/finance/daily-report?days=7`  | ✅ revenue 12.90 / refund 3.00 / net 9.90            |
| 财务 byChannel                   | 同上                                      | ✅ 1 通道（mock）                                    |
| 财务 byMerchant                  | 同上                                      | ✅ 2 商户                                            |
| 容差更新                         | `POST tolerance?yuan=2`                   | ✅ 生效                                              |
| CSV 导出                         | `GET export?days=7`                       | ✅ 200 / 555 bytes / 含 BOM                          |
| 退款列表                         | `GET /admin/refunds`                      | ✅ 3 条，含 retryCount / manualPayout / tradeNo 字段 |
| Web 上传                         | 99 文件                                   | ✅                                                   |
| /admin/finance/daily-report 路由 | nest RouterExplorer                       | ✅ Mapped                                            |
| /admin/finance/alerts 路由       | nest RouterExplorer                       | ✅ Mapped                                            |

---

## 七、Cron 定时任务

| Job                  | 频率       | 文件                 | 说明                                    |
| -------------------- | ---------- | -------------------- | --------------------------------------- |
| `retryFailedRefunds` | 每分钟     | `refund.service.ts`  | 扫描 nextRetryAt 到时的 FAILED 自动重试 |
| `runReconciliation`  | 每小时     | `finance.service.ts` | 对账扫差异，超容差告警                  |
| `autoRejectExpired`  | 每 10 分钟 | `refund.service.ts`  | PENDING > 7 天自动拒绝                  |

---

## 八、安全注意事项

- 退款金额仅支持全额（不支持部分退款）
- USDT 退款强制走 manualPayout（链上无法自动）
- 商户余额下限 -¥1000，超限需 SUPER_ADMIN 强制覆盖
- 告警邮件含敏感金额信息，仅发 SUPER_ADMIN

---

## 九、待办（下一阶段）

- 微信/支付宝原路退款 adapter（已预留 abstract base）
- 通道手续费自动获取（当前固定 0，需从 PaymentChannel.config 读取）
- 退款记录 1 年后自动清理（需新增 cron job）
- 财务对账差异按 severity 分级通知策略（当前统一站内信+邮件）
