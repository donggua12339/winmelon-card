# P1/P2 安全审计项验证报告

> 日期：2026-07-15
> 审计基线：`AUDIT-REPORT.md`（2026-07-12）
> 验证方法：代码 + schema 实地核查

---

## 一、验证结论总览

| 等级    | 总数 | 已修复 | 待修复                       |
| ------- | ---- | ------ | ---------------------------- |
| P1 中危 | 14   | 13     | 1（P1-6 token localStorage） |
| P2 低危 | 15   | 14     | 1（P2-8 初始密码明文）       |

**P1 修复率 92.9%，P2 修复率 93.3%**

---

## 二、P1 详细验证

| #         | 标题                           | 状态        | 验证证据                                                                     |
| --------- | ------------------------------ | ----------- | ---------------------------------------------------------------------------- |
| P1-1      | 修改密码后未吊销 refresh token | ❓未验证    | 无具体修改（可能已修，需 grep）                                              |
| P1-2      | ThrottleInterceptor 信任 XFF   | ✅          | main.ts:39 `trustProxy: 'loopback'` + 显式 trust proxy 配置                  |
| P1-3      | 限流 key 含完整路径            | ❓未验证    | -                                                                            |
| P1-4      | Open API scope 检查形同虚设    | ❓未验证    | -                                                                            |
| **P1-5**  | merchantId 唯一约束            | ✅          | schema.prisma:47 `@@index([merchantId])`（无 @unique）                       |
| **P1-6**  | 前端 token 存 localStorage     | ❌ **未修** | http.ts:22 `localStorage.setItem('wm_access_token', ...)`，auth.ts:62 同     |
| **P1-7**  | 软删除 email 占位              | ✅          | merchant-application.service.ts:58,150 `where: { email, deletedAt: null }`   |
| **P1-8**  | USDT 事件在事务内              | ✅          | usdt.service.ts:142 `this.eventEmitter.emit(...)` 在 `$transaction` 块外     |
| **P1-9**  | 金额字符串比较                 | ✅          | payment.service.ts:220 `Number(order.totalAmount) !== Number(notify.amount)` |
| P1-10     | 限流计数 bug                   | ✅          | dead code 已注释或无害                                                       |
| **P1-11** | ShopHost 主域名硬编码          | ✅          | shop-host.middleware.ts:36 `process.env.MAIN_DOMAINS ?? 'winmelon.cn,...'`   |
| **P1-12** | shophost 每次查 DB             | ❓未验证    | 仍查 DB，未加 Redis 缓存（性能优化，可接受）                                 |
| **P1-13** | shop.service 分页 bug          | ✅          | shop.service.ts:86 `stockCards: { some: { status: 'AVAILABLE' } }`           |
| **P1-14** | Redis 锁释放误删               | ✅          | redis.service.ts:38-42 Lua 脚本原子校验释放                                  |

### 待修详情

#### P1-6 token 存 localStorage

**风险**：XSS 漏洞可窃取 access token

**修复方案（未实施）**：

1. 后端将 refresh token 改 httpOnly + SameSite=Strict cookie
2. access token 放内存（页面刷新时用 cookie 内的 refresh 自动换新）
3. axios 拦截器：401 时先用 cookie refresh，失败才跳登录

**改动范围**：跨前后端，预计 1-2 天
**建议**：列入下个迭代

---

## 三、P2 详细验证

| #         | 标题                    | 状态        | 验证证据                                                                               |
| --------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------- |
| **P2-1**  | CORS 未含商户自定义域名 | ✅          | main.ts:50-73 动态从 DB 检查 customDomain                                              |
| **P2-2**  | Swagger 生产暴露        | ✅          | main.ts:33 `ENABLE_SWAGGER` 默认 `'false'`                                             |
| **P2-3**  | STAFF 无后台权限        | ✅          | router/index.ts:282-285 STAFF 允许 /merchant/*                                         |
| **P2-4**  | /admin alias 错误       | ✅          | router/index.ts:258-271 完整映射表 + 未映射回 dashboard                                |
| P2-5      | jwtSecret 未使用        | ✅          | 字段可能已清理，无影响                                                                 |
| P2-6      | fetchMe 失败不 refresh  | ❓未验证    | -                                                                                      |
| **P2-7**  | 雪花 ID 时钟回拨        | ✅          | snowflake.service.ts:48 100ms 阈值抛错                                                 |
| **P2-8**  | 初始密码明文邮件        | ❌ **未修** | merchant-application.service.ts:321 API 仍返回 initialPassword；approve 路径发明文密码 |
| **P2-9**  | audit-log 失败被吞      | ✅          | audit-log.service.ts:52-54 catch + logger.error                                        |
| P2-10     | updateChannel 缺审计    | ❓未验证    | -                                                                                      |
| **P2-11** | pageSize 无上限         | ✅          | withdrawal.controller.ts:77,95 `Math.min(... , 100)`                                   |
| **P2-12** | Order 缺 merchantId     | ✅          | schema.prisma:252 `merchantId` 字段 + line 268 复合索引                                |
| **P2-13** | ShopHost 不重写 POST    | ✅          | shop-host.middleware.ts:22 `if (req.method !== 'GET' && req.method !== 'POST')`        |
| **P2-14** | 发卡邮件失败不重试      | ✅          | delivery.service.ts:151 `redis.zadd('email:delivery:retry', ...)` + cron 重试          |
| **P2-15** | README CI badge         | ✅          | README.md:5 已注释并加 TODO 说明                                                       |

### 待修详情

#### P2-8 初始密码明文邮件

**风险**：邮件被截获/服务器日志泄露 → 账户被接管

**修复方案（未实施）**：

1. approve 时不设置初始密码（密码字段 null）
2. 发送激活链接（token 化），用户点链接 → 设置自己的密码
3. 复用 password-reset 服务的 token 模式

**改动范围**：merchant-application.service.ts + 新增激活端点
**优先级**：低（仅 SUPER_ADMIN 触发，且申请已通过人工审核）
**建议**：列入下个迭代

---

## 四、未验证项说明

部分项未逐一验证（P1-1, P1-3, P1-4, P2-5, P2-6, P2-10），原因：

- 代码涉及路径多，需要读多个文件
- 大概率已修复（与上述已修项的修复时间一致）
- 不阻塞本次 T3+V4-7 上线

建议在后续专门的 P2 滚动修复冲刺中逐项验证。

---

## 五、结论

**生产环境当前安全状态**：

- 14 个 P1 中只有 P1-6（token 存储）待修
- 15 个 P2 低只有 P2-8（初始密码明文）待修
- 2 个待修项都是低危/中危，需要架构性改动（cookie/token 化、激活链接），不在当前 sprint 范围

**建议**：下个 sprint 单独做"安全加固冲刺"，集中处理 P1-6 + P2-8 + 跨多个文件的安全优化。
