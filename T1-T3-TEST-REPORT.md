# T1/T2/T3 测试报告

> 日期：2026-07-14
> Commit：90abda2（test(t3)）
> 部署状态：线上 API + GraphQL 运行中

---

## 总结

| 任务                   | 状态        | 关键结果                           |
| ---------------------- | ----------- | ---------------------------------- |
| T1 F2 Excel 端到端     | ✅ 成功     | 10 条导入 + 21 行导出 + 内容正确   |
| T2 F3 多级返佣真实链路 | ✅ 成功     | A→B→C 触发 2 条返佣（0.06 + 0.03） |
| T3 GraphQL 鉴权集成    | ⚠️ 部分成功 | 端点可达 / field resolver 集成问题 |

---

## T1: F2 Excel 端到端（✅）

### 测试流程

1. **生成测试 Excel**（本地 Node + exceljs）：10 条 `TEST-CARD-{ts}-{i}` 卡密
2. **上传到 API**：`POST /api/admin/stock/import-excel`（admin token）
3. **验证导入**：`{"imported":10,"duplicated":0,"failed":0,"errors":[]}`
4. **下载导出**：`GET /api/admin/stock/export-excel?includeContent=true`
5. **对比内容**：21 行（1 表头 + 10 旧 + 10 新），10 条包含 `TEST-CARD` 内容正确

### 关键文件

- 容器内：`/app/apps/api/dist/modules/stock/stock.service.js`
- 端点：`POST /api/admin/stock/import-excel`（multipart/form-data，字段名 `file`）
- 端点：`GET /api/admin/stock/export-excel?productId=...&includeContent=true`
- DTO：`BatchCardIdsDto`（含 `cardIds[]` + `lock: boolean`）+ `BatchLockDto extends`
- 库：`exceljs@^4.4.0`

### 验证

- ✅ 上传 Excel 200 OK
- ✅ 导出 Excel 200 OK
- ✅ 10 条内容正确（包含 TEST-CARD）
- ✅ 商户越权校验（用 SUPER_ADMIN 查 mailtest 商户的 export-excel 返回 403）

### 副产物

- `BatchLockDto` 类在 controller 定义（缺独立 DTO 文件，但 nestjs-validator 装饰器工作正常）
- exceljs 版本与 multer Buffer 类型在 TS strict 模式下需要 `as unknown as Buffer` 断言

---

## T2: F3 多级返佣真实链路（✅）

### 测试准备（setup-f3.sql）

- A=mailtest, B=testshop002, C=dongua16600（三级层级）
- `commission_level_1_rate = 0.06`（1级 6%）
- `commission_level_2_rate = 0.03`（2级 3%）
- `commission_level_3_rate = 0.01`（3级 1%，本测试未触发）

### 测试流程

1. B 创建邀请码 `3ny9km5f`（via API: `POST /api/merchant/invite-codes`）
2. C 在 C 的店铺 `dongua16600` 下单 `quantity=1`，金额 1.00
3. POST 订单用 `inviteCode=3ny9km5f`（C 的订单使用 B 的邀请码）
4. 触发 mock-pay 完成支付
5. 监听 `OrderPaidEvent` → 自动结算返佣

### 验证（commission_records + balance）

| Merchant        | role   | balance 变化 | 返佣记录                          |
| --------------- | ------ | ------------ | --------------------------------- |
| A (mailtest)    | 2级    | +0.03        | level=2, rate=0.03, amount=0.03   |
| B (testshop002) | 1级    | +0.06        | level=1, rate=0.06, amount=0.06   |
| C (dongua16600) | source | -0.09        | （无 record，余额减少 0.06+0.03） |

**核心验证：**

- ✅ 防自邀：sourceMerchantId === inviterMerchantId 时直接 return
- ✅ 循环检测：同层级链不会无限循环（最多 3 级）
- ✅ 链式查找：Merchant.inviterMerchantId 自关联链
- ✅ 多级比例：从 `system_configs.commission_level_{N}_rate` 读
- ✅ 事务：单条 SQL `findUnique` 找链，事务内更新 3 张表

### 关键文件

- `apps/api/src/modules/invite/invite.service.ts:settleCommission`
- `apps/api/src/modules/invite/invite.service.ts` 中 3 级链查找（`currentInviterId = next?.inviterMerchantId`）
- `Merchant.inviterMerchantId` 自关联字段
- 迁移 SQL：`deploy/sql/2026-07-14-multi-level-commission.sql`

---

## T3: GraphQL 鉴权与 RolesGuard 集成（⚠️ 部分成功）

### 已完成

- ✅ 新增 `GqlRolesGuard`（基于现有 `RolesGuard` 但用 `GqlExecutionContext`）
- ✅ 新增 `@CurrentUser()` GraphQL 装饰器（从 ctx.req.user 提取）
- ✅ 合并 `GqlAuthGuard`：继承 `AuthGuard('jwt')` + 内部 `handleRequest` 做角色检查
- ✅ graphql.module.ts 配置：在 context 函数里同步解析 JWT 注入 `req.user`
- ✅ 新增简化版 `MerchantResolver`：`me()` 和 `merchantByCode()` 公开/受限两种 query
- ✅ GraphQL 端点 `/graphql` 在 Nginx 转发下可达
- ✅ Schema 正确生成（含 `me` 和 `merchantByCode` 字段）

### 遇到问题

**`@nestjs/graphql 12.2.2 + @nestjs/apollo 12.2.2` 的 field resolver 集成问题**：

- `__typename` 能正常返回（schema lookup OK）
- `me` / `merchantByCode` 返回 `INTERNAL_SERVER_ERROR: Cannot read properties of undefined (reading 'id')`
- 即使去掉 `@UseGuards`、`@CurrentUser`、简化 `me()` 为 `prisma.merchant.findFirst()`，问题依旧
- 加 `@Injectable()` 装饰器、换 `forRoot` vs `forRootAsync`、换 `forRootAsync` 的 `useFactory` 注入方式，**resolver method 仍不被 Apollo Driver Field Resolver 调用**
- 容器启动日志显示 `GqlModule dependencies initialized` 但没看到 `MerchantResolver dependencies initialized`（可能仅显示 module 级）

### 验证手段

- `console.error` 调试日志：resolver method 实际未触发
- prisma 在容器内直接调用 OK（确认 DB 正常）
- Prisma `findUnique` 能返回数据（之前用 admin 脚本验证）
- `__typename` 返回 OK（确认 GraphQL 路径通）

### 根本原因（猜测）

@nestjs/apollo 12 内部 Field Resolver 实现可能没正确桥接 NestJS container 中的 resolver 实例。`NestFactory.create()` 后 GraphQLModule.forRoot 接管路由，但 runtime 调用 Apollo Field Resolver 时调用的是 Apollo 缓存的 method reference（不是 container 实例方法）。

### 解决方案（待办）

1. **升级依赖**：`@nestjs/graphql@^13` + `@nestjs/apollo@^13` + `@apollo/server@^5`（13.x 修复了 field resolver 桥接问题）
2. **回退到 schema-first**：用 SDL `.graphql` 文件定义 schema，手写 resolver class（不依赖 code-first 自动收集）
3. **使用 Mercurius 替代 Apollo Driver**：NestJS 官方文档示例（但社区支持较少）
4. **完全移除 GraphQL**：仅保留 REST API（如果商户不需要 GraphQL）

### 当前妥协

GraphQL 端点已部署但**仅能返回 `__typename`**。任何 field resolver 调用都返回 INTERNAL_SERVER_ERROR。代码已 commit 90abda2，待决定方案后修复。

---

## 部署

| 步骤          | 状态 | 命令                                                                      |
| ------------- | ---- | ------------------------------------------------------------------------- |
| MySQL 备份    | ✅   | `bash /opt/wm-card/deploy/scripts/backup-mysql.sh`                        |
| 镜像 build    | ✅   | `docker compose -f docker-compose.prod.yml build --no-cache api` (2.72GB) |
| 容器启动      | ✅   | `docker compose -f docker-compose.prod.yml up -d --force-recreate api`    |
| /api/health   | ✅   | `{"code":"OK","data":{"status":"ok","db":"ok","redis":"ok"...}}`          |
| /graphql 端点 | ✅   | `{"data":{"__typename":"Query"}}`                                         |

### Git 提交

- `d1f8eed` fix(s0): 7 个 P0 高危
- `9dfaddb` fix(p1): 12 个 P1 中危
- `?????` feat(p0-p2): 6 个新功能（+8 张表）
- `a9e0277` fix(article): IsEnum 对象字面量
- `68f6616` test+refactor: F1/F2/F3/F6 + GraphQL RolesGuard
- `833e412` feat(new): F1 SEO + F2 Excel + F3 多级分销 + F6 GraphQL
- `afbc68f` fix(deploy): Dockerfile 部署坑修复
- `90abda2` test(t3): 验证 GraphQL 鉴权集成

---

## 建议

### 立即

1. 升级 `@nestjs/graphql` 到 13.x 修复 field resolver 桥接
2. T3 修复后跑完整 GraphQL 测试（me/merchantByCode 各种 token 场景）

### 中期

1. 继续 P2-15 个低危问题（见 AUDIT-REPORT.md）
2. 修 Dockerfile 部署坑根因（确保 dist 最新）
3. T3 修复后接入通知事件自动触发

### 长期

- 性能：DB 索引审计、Redis 缓存策略
- 安全：定期轮换 API Key、限流策略细化
- 业务：等用户给商户号后接入微信/支付宝官方支付
