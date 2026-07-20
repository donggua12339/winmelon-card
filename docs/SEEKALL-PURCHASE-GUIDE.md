# SeekAll 会员购买与商户配置指南

本文档面向两类读者：

- **买家**：如何在 WM 发卡网购买 SeekAll 会员并激活
- **商户**：如何在 WM 发卡网配置 SeekAll 商品自动发卡

---

## 一、买家：如何购买 SeekAll 会员

### 1. 进入官方店铺

访问 WM 官方发卡网：<https://winmelon.cn/shop/main>

店铺页面会列出所有在售商品，包括 SeekAll 的三个档位：

| 商品         | 价格 | 时长  | 权限                          |
| ------------ | ---- | ----- | ----------------------------- |
| SeekAll 试用 | ¥1   | 7 天  | L0-L2 规则（每账号限购 1 次） |
| SeekAll 月卡 | ¥18  | 30 天 | L0-L2 + 上传规则（5 条/月）   |
| SeekAll 永久 | ¥68  | 永久  | L0-L3 + 上传规则 + 作者徽章   |

> **主推永久**：¥68 一次买断，无续费焦虑，所有 L0-L3 规则永久可用。

### 2. 下单支付

1. 点击对应商品「立即购买」
2. 填写邮箱（用于接收 License code，**务必正确**）
3. 选择支付方式（微信 / 支付宝 / USDT）
4. 完成支付

### 3. 接收 License code

支付成功后：

- 系统自动发货，**1 分钟内**卡密（License code）会发到你填写的邮箱
- 同时在订单查询页 <https://winmelon.cn/query> 输入订单号可立即查看
- 如果 5 分钟未收到邮件，检查垃圾邮件箱，或联系客服（微信 donggua16600）

### 4. 在 SeekAll SDK 激活

拿到 License code 后，在 SeekAll SDK 里激活：

```bash
# SeekAll SDK 激活命令（详见 https://seekall.winmelon.cn/sdk/）
npx seekall activate --license <your_license_code>
```

激活成功后，对应档位的规则权限立即生效。

> **试用档限购 1 次**：每账号只能购买一次 ¥1 试用，重复购买会被系统拒绝。如已用过试用，请直接购买月卡或永久。

### 5. 常见问题

**Q：邮箱填错了怎么办？**
A：在 <https://winmelon.cn/query> 用订单号 + 下单时填写的邮箱查询，能看到卡密。如果邮箱完全无法访问，联系客服手动补发。

**Q：License code 可以退款吗？**
A：未激活的 code 可申请退款（联系客服）。已激活的 code 因为已经生成服务器资源，不支持退款。

**Q：永久档会过期吗？**
A：不会。¥68 一次买断，永久有效。但 SeekAll 服务保留停止运营时按比例退款的权利（详见 SeekAll 服务条款）。

---

## 二、商户：如何配置 SeekAll 商品自动发卡

如果你是商户（非官方店铺），想在自家店铺销售 SeekAll 会员，按以下步骤配置。

### 1. 前置条件

- 已入驻 WM 发卡网（商户后台可访问）
- 已和 SeekAll 团队签约，拿到 `WM_WEBHOOK_SECRET`（用于 webhook 签名验证）
- SeekAll 后台已配置 WM webhook 接收地址

### 2. 创建 SeekAll 商品

在商户后台「商品管理」->「新建商品」：

| 字段         | 填写                                  |
| ------------ | ------------------------------------- |
| 商品名       | SeekAll 会员月卡（或试用/永久）       |
| 价格         | 18（月卡）/ 1（试用）/ 68（永久）     |
| 自动发货     | 开启                                  |
| SeekAll 档位 | 选择 `MONTHLY` / `TRIAL` / `LIFETIME` |

> **关键**：「SeekAll 档位」字段必须正确选择，WM 会根据这个字段通知 SeekAll 生成对应档位的 License code。

### 3. 准备占位卡密

SeekAll 商品**不需要预先导入真实卡密**（License code 由 SeekAll webhook 实时生成）。但 WM 要求商品有库存才能上架，所以需要导入占位卡密：

1. 在「卡密管理」->「批量导入」
2. 选择刚创建的 SeekAll 商品
3. 导入 100 条占位卡密，格式：`SeekAll-Stock-<timestamp>-<seq>`（如 `SeekAll-Stock-20260721-001`）
4. 这些占位卡密不会被实际发给买家，付款成功时 SeekAll webhook 会生成真实 License code 替换

### 4. 验证 webhook 配置

下单测试（用 ¥1 试用档）：

1. 在你的店铺下单购买 SeekAll 试用
2. 支付成功后，检查：
   - WM 订单状态变为「已发卡」
   - 买家邮箱收到 License code（不是占位卡密）
   - SeekAll 后台看到对应的 License 记录
3. 如果发卡失败：
   - 检查商户 .env 是否配置了 `SEEKALL_WEBHOOK_URL` 和 `WM_WEBHOOK_SECRET`
   - 查看 WM API 日志（`docker logs wm-card-api-1 --since 10m | grep -i seekall`）
   - 确认 SeekAll webhook 接收地址可达（`curl https://seekall.winmelon.cn/api/v1/health`）

### 5. webhook 工作流程

```
买家付款成功
  ↓
WM 触发 OrderPaidEvent
  ↓
SeekallWebhookService 监听事件
  ↓
检查订单是否含 seekallTier 商品
  ↓ 是
POST https://seekall.winmelon.cn/api/v1/license/wm-webhook
  body: { wmOrderId, tier, amount, signature }
  signature = HMAC-SHA256(WM_WEBHOOK_SECRET, "{orderNo}|{tier}|{amount}")
  ↓
SeekAll 生成 License code
  ↓
WM 卡密表更新（占位卡密替换为真实 License code）
  ↓
买家邮箱收到 License code
```

### 6. 常见配置问题

**Q：买家收到的还是占位卡密？**
A：webhook 没触发或失败。检查：

- 商品的「SeekAll 档位」字段是否选择
- `WM_WEBHOOK_SECRET` 和 SeekAll 后台配置是否一致
- WM API 容器的 `SEEKALL_WEBHOOK_URL` 环境变量

**Q：webhook 返回 401？**
A：签名错误。确认 `WM_WEBHOOK_SECRET` 两端一致，签名算法是 `HMAC-SHA256`，payload 格式 `{orderNo}|{tier}|{amount}`（tier 小写，amount 不带 ¥ 符号）。

**Q：webhook 返回 400？**
A：请求体格式错误。确认 Content-Type 是 `application/json`，body 字段名严格按 `wmOrderId` / `tier` / `amount` / `signature`。

**Q：SeekAll 生成了 License 但 WM 卡密没更新？**
A：SeekAll webhook 返回了 License code 但 WM 没写入卡密表。查看 WM API 日志的 `SeekallWebhookService` 相关错误。

### 7. 监控建议

- WM 后台「订单管理」：过滤 SeekAll 商品订单，观察发卡成功率
- SeekAll 后台「License 管理」：对比 WM 订单数和 SeekAll License 数，差异超 5% 需排查
- Sentry 错误监控：`SeekallWebhookService` 抛错会上报 Sentry

---

## 三、相关链接

- WM 发卡网：<https://winmelon.cn>
- SeekAll 文档站：<https://seekall.winmelon.cn>
- SeekAll 会员档位说明：<https://seekall.winmelon.cn/guide/membership>
- SeekAll 试用码机制：<https://seekall.winmelon.cn/guide/trial-code>
- WM OpenAPI 文档：[./OPENAPI.md](./OPENAPI.md)
- 售后客服微信：donggua16600
