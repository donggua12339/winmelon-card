# WM Card OpenAPI 文档

WM 官方虚拟卡密交易平台对外开放 API，允许商户通过 API Key 管理商品、卡密、订单。

- Base URL: `https://winmelon.cn/open/v1`
- Swagger UI: <https://winmelon.cn/api/docs>
- 协议: HTTPS（生产强制 TLS）
- 数据格式: JSON（UTF-8）
- 时区: 所有时间字段为 UTC，ISO 8601 格式（如 `2026-07-21T08:30:00.000Z`）

---

## 1. 鉴权

### 1.1 API Key 格式

- 前缀: `sk_live_`
- 长度: 47 字符（`sk_live_` + 32 字节 base64url）
- 仅在创建时返回一次完整 key，平台只存 sha256 哈希
- 支持两种传递方式（任选其一）：

```http
X-API-Key: sk_live_<your_api_key_here>
```

```http
Authorization: Bearer sk_live_<your_api_key_here>
```

### 1.2 Scope 权限

每个 API Key 创建时指定 scope，最小粒度：

| Scope   | 说明                      |
| ------- | ------------------------- |
| `read`  | 查询商品 / 卡密 / 订单    |
| `write` | 创建 / 更新商品、导入卡密 |

调用 `write` 接口但 Key 只有 `read` scope 时返回 `403`。

### 1.3 创建 / 吊销 API Key

通过商户后台 `/merchant/api-keys` 页面操作：

1. 登录商户后台 → 左侧菜单「API Key 管理」
2. 点击「新建 API Key」，填写名称、选择 scope、设置速率限制（默认 60/min）
3. 创建后立即复制完整 key（仅展示一次）
4. 如需吊销，在列表点击「吊销」，立即生效

### 1.4 速率限制

- 每个 API Key 默认 60 次/分钟（创建时可调整，最大 600）
- 超限返回 `429 Too Many Requests`，响应头：
  ```http
  X-RateLimit-Limit: 60
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: 1721542200
  ```

---

## 2. 通用响应格式

### 2.1 成功响应

```json
{
  "code": "OK",
  "data": {/* 业务数据 */},
  "requestId": "req_01J3X..."
}
```

### 2.2 错误响应

```json
{
  "code": "HTTP_401",
  "message": "未登录或登录已过期",
  "requestId": "req_01J3X..."
}
```

> 注：出于安全考虑，4xx 错误的 message 已做脱敏，不会暴露具体校验规则。如需定位问题，把 `requestId` 反馈给平台客服查询日志。

### 2.3 错误码表

| HTTP 状态 | code                    | 说明                                     |
| --------- | ----------------------- | ---------------------------------------- |
| 200       | `OK`                    | 成功                                     |
| 400       | `HTTP_400`              | 请求参数无效（class-validator 校验失败） |
| 401       | `HTTP_401`              | API Key 缺失 / 无效 / 已吊销 / 已过期    |
| 403       | `HTTP_403`              | API Key 缺少所需 scope                   |
| 404       | `HTTP_404`              | 资源不存在（商品/订单不属于此商户）      |
| 429       | `HTTP_429`              | 请求过于频繁                             |
| 500       | `HTTP_500`              | 服务器内部错误（已上报 Sentry）          |
| 502/503   | `HTTP_502` / `HTTP_503` | 网关错误 / 服务不可用                    |

---

## 3. 端点列表

### 商品

| Method | Path                           | Summary  | Scope |
| ------ | ------------------------------ | -------- | ----- |
| GET    | `/open/v1/products`            | 商品列表 | read  |
| GET    | `/open/v1/products/:id`        | 商品详情 | read  |
| POST   | `/open/v1/products`            | 创建商品 | write |
| POST   | `/open/v1/products/:id/update` | 更新商品 | write |

### 卡密

| Method | Path                              | Summary             | Scope |
| ------ | --------------------------------- | ------------------- | ----- |
| GET    | `/open/v1/stock`                  | 卡密列表            | read  |
| POST   | `/open/v1/stock/import`           | 批量导入卡密（CSV） | write |
| GET    | `/open/v1/stock/stats/:productId` | 卡密库存统计        | read  |

### 订单

| Method | Path                  | Summary  | Scope |
| ------ | --------------------- | -------- | ----- |
| GET    | `/open/v1/orders`     | 订单列表 | read  |
| GET    | `/open/v1/orders/:id` | 订单详情 | read  |

---

## 4. 商品接口

### 4.1 GET `/open/v1/products` — 商品列表

**Query 参数：**

| 名称     | 类型   | 必填 | 默认 | 说明                              |
| -------- | ------ | ---- | ---- | --------------------------------- |
| keyword  | string | 否   | -    | 商品名模糊搜索                    |
| status   | string | 否   | -    | `ONLINE` / `OFFLINE` / `SOLD_OUT` |
| page     | int    | 否   | 1    | 页码（1-100）                     |
| pageSize | int    | 否   | 20   | 每页（1-100）                     |

**响应：**

```json
{
  "code": "OK",
  "data": {
    "items": [
      {
        "id": "p_01J3X...",
        "shopId": "s_01J3X...",
        "name": "SeekAll 会员月卡",
        "price": "18.00",
        "status": "ONLINE",
        "stockCount": 100,
        "isAutoDelivery": true,
        "createdAt": "2026-07-21T08:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "requestId": "req_01J3X..."
}
```

### 4.2 GET `/open/v1/products/:id` — 商品详情

**Path 参数：** `id` — 商品 ID

**响应：** 单个商品对象（同列表项 + 详细字段）

### 4.3 POST `/open/v1/products` — 创建商品

**请求体：**

| 字段           | 类型   | 必填 | 说明                                                     |
| -------------- | ------ | ---- | -------------------------------------------------------- |
| shopId         | string | 是   | 店铺 ID（1-64 字符）                                     |
| name           | string | 是   | 商品名（1-255 字符）                                     |
| price          | number | 是   | 售价（0.01-99999.99，2 位小数）                          |
| description    | string | 否   | 描述（最长 65535）                                       |
| originalPrice  | number | 否   | 原价（用于划线显示）                                     |
| categoryId     | string | 否   | 分类 ID                                                  |
| purchaseLimit  | int    | 否   | 单次限购（1-9999）                                       |
| isAutoDelivery | bool   | 否   | 自动发货（默认 true）                                    |
| sort           | int    | 否   | 排序（默认 0）                                           |
| seekallTier    | string | 否   | `TRIAL` / `MONTHLY` / `LIFETIME`（SeekAll webhook 专用） |

**示例：**

```bash
curl -X POST https://winmelon.cn/open/v1/products \
  -H "X-API-Key: sk_live_<your_api_key_here>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "s_01J3X...",
    "name": "测试商品",
    "price": 9.90,
    "isAutoDelivery": true
  }'
```

### 4.4 POST `/open/v1/products/:id/update` — 更新商品

> 使用 POST 替代 PUT，方便部分对接方不支持 PUT 方法。

**请求体：** 同 4.3，所有字段均为可选（`PartialType`），`shopId` 不可改。

---

## 5. 卡密接口

### 5.1 GET `/open/v1/stock` — 卡密列表

**Query 参数：**

| 名称      | 类型   | 必填 | 说明                                         |
| --------- | ------ | ---- | -------------------------------------------- |
| productId | string | 是   | 商品 ID                                      |
| status    | string | 否   | `AVAILABLE` / `LOCKED` / `SOLD` / `DISABLED` |
| page      | int    | 否   | 默认 1                                       |
| pageSize  | int    | 否   | 默认 50（最大 200）                          |

**响应：** 卡密列表（不含卡密明文，只返回元信息）

### 5.2 POST `/open/v1/stock/import` — 批量导入卡密

**请求体：**

| 字段       | 类型   | 必填 | 说明                   |
| ---------- | ------ | ---- | ---------------------- |
| productId  | string | 是   | 商品 ID（1-64 字符）   |
| csvContent | string | 是   | CSV 文本，每行一条卡密 |

**CSV 规则：**

- 单次最多 5000 条
- 单条最长 4096 字符
- 支持双引号包裹（含逗号或换行）
- 行尾 `\n` 或 `\r\n` 均可
- 总大小上限 20MB

**示例：**

```bash
curl -X POST https://winmelon.cn/open/v1/stock/import \
  -H "X-API-Key: sk_live_<your_api_key_here>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "p_01J3X...",
    "csvContent": "ABC-DEF-GHI\nJKL-MNO-PQR\nSTU-VWX-YZA"
  }'
```

**响应：**

```json
{
  "code": "OK",
  "data": {
    "imported": 3,
    "duplicates": 0,
    "errors": []
  },
  "requestId": "req_01J3X..."
}
```

### 5.3 GET `/open/v1/stock/stats/:productId` — 卡密库存统计

**Path 参数：** `productId`

**响应：**

```json
{
  "code": "OK",
  "data": {
    "productId": "p_01J3X...",
    "available": 87,
    "locked": 3,
    "sold": 10,
    "disabled": 0,
    "total": 100
  },
  "requestId": "req_01J3X..."
}
```

---

## 6. 订单接口

### 6.1 GET `/open/v1/orders` — 订单列表

**Query 参数：**

| 名称     | 类型   | 必填 | 默认 | 说明                                                                    |
| -------- | ------ | ---- | ---- | ----------------------------------------------------------------------- |
| page     | int    | 否   | 1    | 页码                                                                    |
| pageSize | int    | 否   | 20   | 每页                                                                    |
| status   | string | 否   | -    | 订单状态（`PENDING` / `PAID` / `DELIVERED` / `REFUNDED` / `CLOSED` 等） |

**响应：** 订单列表（含买家邮箱、金额、卡密发放状态等）

### 6.2 GET `/open/v1/orders/:id` — 订单详情

**Path 参数：** `id` — 订单 ID

**响应：** 单个订单对象

---

## 7. SDK 示例

参见：

- [Python 示例](./sdks/python/wm_card_client.py)
- [Node.js 示例](./sdks/node/wm-card-client.js)

---

## 8. 限流与最佳实践

1. **复用 HTTP 连接**：客户端启用 keep-alive，降低 TLS 握手开销
2. **指数退避重试**：遇 5xx / 429 时退避（如 1s → 2s → 4s → 8s），最多 3 次
3. **避免并发导入同一商品**：卡密导入会加锁，并发会阻塞
4. **缓存商品列表**：商品变动少，本地缓存 60s 可大幅减少 API 调用
5. **保密 API Key**：不要把 key 提交到 git / 写进前端代码 / 截图分享
6. **生产用 `sk_live_`，测试请在商户后台创建独立 key 并设置低速率限制**

---

## 9. 变更日志

| 日期       | 版本  | 说明                                            |
| ---------- | ----- | ----------------------------------------------- |
| 2026-07-21 | 1.0.0 | 首版：9 个端点 + ApiKey 鉴权 + read/write scope |
