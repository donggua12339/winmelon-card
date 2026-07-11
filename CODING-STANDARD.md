# WM 官方虚拟卡密交易平台 —— 编码规范

> 版本：1.0.0 ｜ 修订日期：2026-07-11
> 状态：强制（PR 必须符合，CI 自动检查）

## 1. 总则

- **可读性 > 简洁性 > 巧妙性**：宁可多两行清晰代码，不写炫技单行。
- **不为没发生的场景写防御代码**：信任框架与内部调用，只在系统边界校验。
- **不过度抽象**：三处复用前不抽象，一次使用禁止建工具类。
- **注释只解释"为什么"**：代码已说明"做什么"时，禁止重复注释。

## 2. 命名

### 2.1 通用
| 类型 | 风格 | 示例 |
|------|------|------|
| 变量、函数 | camelCase | `getUserById`、`orderId` |
| 常量（编译期） | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 类、接口、类型 | PascalCase | `OrderService`、`PaymentResult` |
| 文件名 | kebab-case | `order.service.ts`、`payment-result.ts` |
| 枚举成员 | PascalCase | `OrderStatus.Paid` |
| 布尔变量 | `is`/`has`/`can` 前缀 | `isPaid`、`hasStock` |

### 2.2 禁用
- 单字母变量（循环计数 `i/j/k` 除外）。
- 缩写：`usr`、`ord`、`pwd`、`cnt` 禁用。
- 匈牙利前缀：`strName`、`intCount` 禁用。

### 2.3 数据库字段
- snake_case：`created_at`、`merchant_code`、`order_id`。
- 布尔字段以 `is_` / `has_` 开头：`is_paid`、`has_stock`。
- 时间字段统一：`created_at` / `updated_at` / `deleted_at`（软删除）。

## 3. TypeScript 规范

### 3.1 tsconfig 强约束
- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"noImplicitOverride": true`
- `"noFallthroughCasesInSwitch": true`
- `"exactOptionalPropertyTypes": true`

### 3.2 类型规则
- **禁止 `any`**：必须用 `unknown` 或具体类型。`any` 必须在 PR 中给出理由。
- **禁止 `as` 强制断言**，除非来自第三方类型缺失，并注释原因。
- **接口优先于类型别名**（除非需要联合 / 映射类型）。
- **DTO 用 class + class-validator**，不要用 interface 做运行时校验。
- **共享类型放 `packages/shared-types`**，前后端复用。

### 3.3 null / undefined
- 默认非空，明确可能为空用 `T | null`。
- 取值后必须判空，禁止 `!` 非空断言（除测试代码）。
- 可选链优先：`order?.payment?.channel`。

## 4. 项目结构约定

### 4.1 NestJS 模块布局
每个业务模块目录：
```
modules/order/
├── dto/
│   ├── create-order.dto.ts
│   └── order-query.dto.ts
├── entities/
│   └── order.entity.ts          # 领域模型
├── order.repository.ts          # 接口
├── order.service.ts             # 应用服务
├── order.controller.ts
├── order.module.ts
└── order.events.ts              # 事件定义
```

### 4.2 Vue 组件布局
```
views/admin/order/
├── OrderList.vue        # 页面
├── OrderDetail.vue
├── components/          # 仅本页用
│   └── OrderFilter.vue
└── composables/
    └── useOrderList.ts
```

### 4.3 文件大小
- 单文件 ≤ 400 行，超出必须拆分。
- 单函数 ≤ 50 行，超出必须重构。
- Vue 单文件组件 ≤ 300 行。

## 5. 错误处理

### 5.1 异常分类
| 类型 | 用途 | 示例 |
|------|------|------|
| `BusinessError` | 领域业务异常 | `OutOfStockError` |
| `ValidationError` | 输入校验失败 | class-validator 抛出 |
| `AuthError` | 鉴权失败 | `UnauthorizedError` |
| `ExternalServiceError` | 第三方调用失败 | 支付通道超时 |
| `SystemError` | 不可恢复系统异常 | DB 连接断开 |

### 5.2 规则
- **不吞异常**：`catch` 必须处理或重新抛出。
- **业务异常可预期**：service 层抛领域异常，controller 转换为 HTTP 状态。
- **第三方异常要包装**：`PaymentAdapterError` 包装 SDK 原始异常。
- **禁止在 controller 写 try/catch**：统一交给全局 ExceptionFilter。
- **5xx 必须记录堆栈**：4xx 只记请求上下文。

### 5.3 错误响应格式
```json
{
  "code": "OUT_OF_STOCK",
  "message": "商品库存不足",
  "details": { "productId": "p_xxx", "remaining": 0 },
  "requestId": "req_abc123"
}
```

## 6. 日志

### 6.1 框架
- 后端：pino（结构化 JSON）。
- 前端：生产环境上报到后端日志接口。

### 6.2 规则
- 所有日志携带 `requestId`（中间件注入）。
- 日志级别：
  - `error`：系统异常、5xx、第三方调用失败。
  - `warn`：业务异常、4xx、降级触发。
  - `info`：订单创建、支付成功、发卡完成、库存预警。
  - `debug`：开发期细节，生产关闭。
- **禁止记录**：
  - 卡密明文（只记 `cardId`）。
  - 密码、token、JWT、API Key、支付密钥。
  - 用户手机号 / 邮箱完整内容（脱敏：`13****1234`）。
- 日志格式统一 JSON，禁止字符串拼接。
  - ❌ `logger.info('order ' + orderId + ' paid')`
  - ✅ `logger.info({ orderId, event: 'order.paid' }, 'order paid')`

## 7. 安全编码基线

详见 `SECURITY-BASELINE.md`，此处只列编码层强约束：

- **所有 SQL 走 Prisma**：禁止原生 SQL 字符串拼接。如必须用 `$queryRaw`，必须用 `$queryRaw` 模板字符串参数化。
- **所有外部输入经 DTO 校验**：class-validator + whitelist + forbidNonWhitelisted。
- **所有输出到模板的变量自动转义**：Vue 默认转义，禁用 `v-html`，除非内容来自可信源。
- **所有密码用 bcrypt**，cost ≥ 10。
- **所有 token 使用强随机**：`crypto.randomBytes(32)` 起步。
- **禁止硬编码密钥**：必须从环境变量读。

## 8. Git 提交规范

### 8.1 Commit Message
格式：`<type>(<scope>): <subject>`

| type | 含义 |
|------|------|
| feat | 新功能 |
| fix | bug 修复 |
| docs | 文档 |
| style | 格式（不影响代码逻辑） |
| refactor | 重构 |
| perf | 性能 |
| test | 测试 |
| chore | 构建 / 依赖 / 杂项 |
| security | 安全修复（高优） |

示例：
```
feat(order): 支持下单预扣库存
fix(payment): 修复易支付回调验签缺失 sign 字段校验
security(stock): 卡密存储改用 AES-256-GCM
```

### 8.2 分支策略
- `main`：可发布主干，受保护，仅接收 PR。
- `develop`：开发集成分支。
- `feature/<name>`：功能分支。
- `fix/<name>`：修复分支。
- `hotfix-<version>`：紧急修复。

### 8.3 PR 规范
- 单 PR ≤ 500 行 diff（超出必须拆分）。
- 必须关联 issue。
- 必须通过 CI（lint、test、build）。
- 安全相关 PR 必须打 `security` 标签，至少 1 人 review。

## 9. 代码风格

### 9.1 工具链
- ESLint + Prettier，配置入库，CI 强制。
- husky + lint-staged 在 commit 时自动格式化。

### 9.2 关键风格
- 缩进：2 空格。
- 引号：单引号。
- 末尾分号：保留。
- 末尾逗号：多行 always。
- 行宽：120。
- import 顺序：node 内置 → 第三方 → 本地别名 → 相对路径。

### 9.3 Vue 规范
- `<script setup lang="ts">` 组合式 API 优先。
- 必须使用 TypeScript。
- props 必须定义类型，禁止 `defineProps` 无类型。
- 事件必须 `defineEmits<{ (e: 'change', v: string): void }>()`。

## 10. 测试规范

### 10.1 范围
- **核心领域逻辑必须单测**：库存扣减、卡密取发、订单状态机、支付验签。
- **API 关键路径必须集成测试**：下单、回调、发卡、查询。
- **前端核心组件单测**：下单表单、订单查询页。

### 10.2 覆盖率
- 领域层 ≥ 80%。
- 应用层 ≥ 60%。
- 控制器层 ≥ 40%。

### 10.3 命名
- 测试文件 `*.spec.ts`。
- 描述用业务语言：`describe('下单流程', () => it('库存不足应抛 OutOfStockError'))`。

## 11. 注释规范

- **公开 API 必须有 TSDoc**：参数、返回值、异常。
- **复杂逻辑必须注释意图**：算法、业务规则。
- **TODO / FIXME 必须带 issue 号**：`// TODO(#123): 优化取卡性能`。
- **禁止"翻译式"注释**：`// 获取用户` → `getUserById()`。

## 12. 依赖管理

- 新增依赖必须 PR 说明理由 + 替代方案比较。
- 禁止引入有已知高危漏洞的包（`npm audit` 必须通过）。
- 锁定版本：`package-lock.json` 入库。
- 区分 `dependencies` / `devDependencies`，严禁错放。

## 13. 性能基线

- 单接口 P95 < 300ms（不含第三方调用）。
- 列表查询必须分页，默认 20，最大 100。
- DB 查询禁止 N+1：必须用 `include` / `select` 一次取齐。
- 禁止在循环里查 DB / 调外部 API。

## 14. 国际化

- 后端错误码用英文常量，message 走 i18n key。
- 前端文案全部走 i18n（vue-i18n），默认中文，预留英文。
- 时间统一 UTC 存储，前端按用户时区展示。

## 15. 不可触碰的红线

以下行为一经发现 PR 直接 reject：

1. 在代码、日志、文档中硬编码密钥、密码、token。
2. 用 `console.log` 打印卡密、密码、支付原始数据。
3. 绕过 DTO 校验直接读 `req.body`。
4. 字符串拼接 SQL。
5. 在 `v-html` 中渲染用户输入。
6. 把 `.env` 提交到 git。
7. 用 `as any` 绕过类型检查。
8. 在 controller 写业务逻辑（应放 service）。
9. 在 service 写 HTTP 响应（应放 controller）。
10. 删除审计日志 / 越权查询他人订单。
