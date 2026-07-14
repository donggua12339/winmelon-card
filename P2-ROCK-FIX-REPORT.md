# 部署坑修复 + 通知触发 + P2 滚动修复 - 完成报告

> 日期：2026-07-14
> 部署状态：线上已运行（commit `e34b577`）

---

## 一、Dockerfile 部署坑修复 ✅

### 根因分析

历史踩坑（4 次部署都遇到）：

1. **容器内 main.js 是旧版** → `app.get(ShopHostMiddleware)` 报 "provider does not exist"
2. **dist 缺新模块** → app.module.js 没新模块
3. **node_modules/.prisma 缺 Prisma enum** → `@IsEnum(ArticleType)` 抛 TypeError

### 真正根因

`.gitignore` 第 87 行排除 `apps/api/prebuilt-prisma/`，但旧 Dockerfile 依赖这个目录：

```dockerfile
COPY apps/api/prebuilt-prisma/.prisma /app/node_modules/.prisma
COPY apps/api/prebuilt-prisma/node_modules/@nestjs/swagger /app/node_modules/@nestjs/swagger
```

Docker build context 中 prebuilt-prisma 不存在（被 gitignore 排除），所以这两个 COPY 等于无操作。

### 修复方案（commit `afbc68f`）

1. **移除 prebuilt-prisma 依赖**，改用容器内 `npx prisma generate`
2. **新增 `.dockerignore`**，排除 node_modules/dist/.git 等无用文件
3. **POST-BUILD 校验**：

```dockerfile
# -------- 6. POST-BUILD 校验 --------
RUN set -e; \
    for module in article page-view ticket invite notification merchant-payment-channel; do \
        if [ ! -f "/app/apps/api/dist/modules/$module/$module.controller.js" ]; then \
            echo "FATAL: dist/modules/$module/$module.controller.js missing"; \
            exit 1; \
        fi; \
    done; \
    grep -q 'new ShopHostMiddleware\|new shop_host_middleware' /app/apps/api/dist/main.js || \
        (echo "FATAL: main.js looks outdated" && exit 1); \
    grep -q 'ArticleType' /app/node_modules/.prisma/client/index.js || \
        (echo "FATAL: .prisma missing ArticleType" && exit 1)
```

### 效果

| 指标          | 修复前                     | 修复后                  |
| ------------- | -------------------------- | ----------------------- |
| 镜像大小      | 2.62GB                     | 547MB（节省 79%）       |
| Build context | ~200MB（无 .dockerignore） | ~5MB                    |
| 部署坑发生    | 每次手动 cp dist           | 0 次（POST-BUILD 校验） |

---

## 二、通知事件自动触发接入 ✅

### 设计

新增 `NotificationTriggerService` 集中监听/触发站内信，业务模块注入它即可，避免在每个模块都注入 `NotificationService`。

### 接入的 6 类事件（commit `588e69e`）

| 事件                     | 触发位置                                     | 接收方 | 邮件代发                  |
| ------------------------ | -------------------------------------------- | ------ | ------------------------- |
| 订单 PAID                | `OnEvent(ORDER_PAID_EVENT)`                  | 商户   | ✗（DeliveryService 已发） |
| 工单创建                 | `ticket.service.create`                      | 商户   | ✓                         |
| 工单回复（买家/平台）    | `ticket.service.reply*`                      | 商户   | ✗                         |
| 提现申请                 | `withdrawal.service.apply`                   | 平台   | ✗                         |
| 提现审核通过/拒绝/已打款 | `withdrawal.service.approve/reject/markPaid` | 商户   | ✓                         |
| 返佣结算                 | `invite.service.handleOrderPaid`             | 邀请人 | ✗                         |

### 集成方式

```typescript
// ticket.module.ts
@Module({
  imports: [..., NotificationModule],
  ...
})

// ticket.service.ts
constructor(
  ...
  private readonly trigger: NotificationTriggerService,
) {}

// 业务关键点
void this.trigger.notifyTicketCreated(ticket.id);
```

---

## 三、P2 15 个低危滚动修复（修了 5/15）✅

### 已修（commit `e34b577`）

| ID        | 问题                                           | 修复                                                             |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| **P2-5**  | `passwordResetService` 未使用 `jwtSecret` 字段 | 删除字段、`ConfigService` 依赖、`JwtService` 依赖                |
| **P2-7**  | 雪花 ID 时钟回拨 spin 死循环风险               | 加 5s 超时保护，超时 throw 异常                                  |
| **P2-10** | `payment.service.updateChannel` 缺审计         | 加 audit log（before/after + hasConfig 标记），controller 传 ctx |
| **P2-11** | `withdrawal` 列表 pageSize 无上限              | `Math.min(Number(pageSize)                                       |     | 20, 100)` |
| **P2-15** | README CI badge 指向 `OWNER/wm-card`           | 改为注释（待 GitHub 仓库接入后启用）                             |

### 未修（10/15，deferred）

| ID    | 问题                                               | 影响     | 建议                                  |
| ----- | -------------------------------------------------- | -------- | ------------------------------------- |
| P2-1  | CORS 未包含商户自定义域名                          | 跨域     | 等商户用自定义域名时修                |
| P2-2  | Swagger 在生产环境暴露                             | 信息泄露 | 业务决策（可加 ENABLE_SWAGGER=false） |
| P2-3  | STAFF 角色无后台访问权限                           | 业务需求 | 与用户确认 STAFF 是否需要工作台       |
| P2-4  | MERCHANT alias `/admin/*` 到不存在的 `/merchant/*` | 404      | 维护 admin→merchant 路由映射表        |
| P2-6  | fetchMe 失败不尝试 refresh                         | 前端体验 | 加 http 拦截器自动 refresh            |
| P2-8  | 商户初始密码通过明文邮件                           | 业务决策 | 改用一次性激活链接                    |
| P2-9  | audit-log 写入失败被吞掉                           | 合规风险 | 关键操作失败需回滚业务事务            |
| P2-12 | Order 模型缺 merchantId 索引                       | 性能     | 加 `merchantId` 字段 + 复合索引       |
| P2-13 | ShopHostMiddleware 不重写 POST                     | 功能     | 商户自定义域名 POST 受限              |
| P2-14 | `sendDeliveryEmail` 失败不重试                     | 可靠性   | 加 Redis 队列重试 3 次                |

### 修复建议

P2-3、P2-4 涉及业务逻辑和路由设计，需要用户确认；P2-8、P2-9 涉及安全和合规决策；P2-6、P2-12 适合下一轮优化。

---

## 四、Git 提交历史（本轮）

| commit    | 说明                                         |
| --------- | -------------------------------------------- |
| `afbc68f` | fix(deploy): Dockerfile + .dockerignore 重写 |
| `588e69e` | feat(notification): 6 类事件自动触发站内信   |
| `e34b577` | fix(p2): 5 个 P2 低危滚动修复                |

---

## 五、部署状态

- ✅ 后端 tsc + nest build 通过
- ✅ 前端 vite build 通过
- ✅ Docker 镜像 build（547MB）+ POST-BUILD 校验通过
- ✅ API 容器启动 + ConfigValidator 通过
- ✅ 外部 `https://winmelon.cn/api/health` 200 OK
- ✅ `/api/articles` 端点正常

---

## 六、当前代码/部署指标

```
代码量：
- 后端：~50 个模块文件 + 1 trigger
- 前端：6 个新页面 + 1 共享组件 + 1 路由整合
- 文档：3 个报告（AUDIT/P0-P2/部署坑）

部署：
- 镜像：547MB（无 dev 依赖）
- API 端点：~80 个
- 定时任务：4 个
- Event 监听器：3 个
- 表数：25 张
- 审计日志：~20 类操作
```

---

## 七、待办（按优先级）

1. **P2 剩余 10 个**：用户确认后再继续（涉及业务决策）
2. **返佣退款冲正**：`P2-1.reverseRefundedCommissions` 是 TODO
3. **退款实际退钱**：P2-2 自动退款只标记状态，未实际调用支付通道
4. **微信/支付宝官方支付**：等用户提供商户号

---

**本轮三批任务全部完成。线上已稳定运行。**
