# 性能与可用性提升 — 3 里程碑方案规格

> 日期：2026-07-17
> 决策：no-grill-me 12 决策
> 风格：A. 性能与可用性优先 / i. 里程碑驱动 / Z. 全量闭环集中发 / 3. 我推荐 + 你选

---

## 总览

| 里程碑 | 内容                                              | 周期   |
| ------ | ------------------------------------------------- | ------ |
| M1     | Redis 缓存层（商品/店铺/配置，写穿透 + 穿透防护） | 1-2 周 |
| M2     | GlitchTip 错误 + 性能监控（邮件告警 + PII 脱敏）  | 1-2 周 |
| M3     | API 3 实例 + Nginx round-robin + SIGTERM 排水     | 2-3 周 |

每个里程碑独立可交付，全量闭环：测试 → 部署 → 监控验证。

---

## M1：Redis 缓存层

**缓存对象**：

- 商品列表 `/api/shop/:code/products`：TTL 5min
- 商品详情 `/api/shop/:code/products/:id`：TTL 5min
- 店铺基本信息 `/api/shop/:code/info`：TTL 10min
- 系统配置 `system_configs`：TTL 10min

**写穿透**：

```
Service.update() {
  await tx.$transaction([DB.update, ...]);
  await redis.set(key, freshValue, 'EX', ttl);
}
```

**Cache Key 规范**：`cache:{module}:{resource}:{id}`，如 `cache:product:abc123`

**穿透防护**：DB 返回空时，缓存空值 `__NULL__` + TTL 60s，防恶意查询打 DB

**失败容忍**：Redis 写失败 → log 警告 + 不抛错（不影响主流程）。Redis 读失败 → 直接走 DB

**验收指标**：

- 缓存命中率 > 80%（Redis INFO hits/(hits+misses)）
- 商品列表 P95 < 200ms（DB 直查基线 ~300ms）

**实现文件**：

- 新增 `infrastructure/cache/cache.service.ts`
- 新增 `infrastructure/cache/cache.decorator.ts`（@Cacheable 注解）
- 接入 shop / product / system_config service

**风险**：

- 写穿透代码侵入性强 → 每个 service 改一处
- 分布式缓存一致性问题 → 当前单机 Redis，无分布式问题

---

## M2：GlitchTip 错误 + 性能监控

**部署**：自部署 GlitchTip on `/opt/wm-card/glitchtip`（Docker Compose）

**采集范围**：

- 后端异常（nest 全局 ExceptionFilter 接入）
- HTTP 5xx 响应
- API 响应时间（performance）
- 前端 JS 错误 + 性能（@sentry/browser）

**告警**：邮件告警（SMTP 复用现有 QQ 配置，单独告警邮箱）

**PII 脱敏**：

- 邮箱：`abc@xxx.com` → `a***@xxx.com`
- 手机/身份证/银行卡：完全脱敏
- 错误内容里的卡密/密码：完全脱敏
- request body：默认脱敏，allowlist 白名单字段才上报

**验收指标**：

- 错误捕获率 100%（所有抛出的异常都进 Sentry）
- 性能数据上报成功率 > 95%（失败不影响主流程）
- 邮件告警到达率 > 99%

**实现文件**：

- 新增 `infrastructure/sentry/sentry.module.ts`
- 前端 `apps/web/src/main.ts` 加 Sentry init
- backend `apps/api/src/main.ts` 加 Sentry init

**风险**：

- 自部署 GlitchTip 需要 ~512MB 内存 + 数据库
- Sentry SDK 性能开销（异步上报，影响 < 1ms）

---

## M3：API 3 实例 + 优雅停机

**实例数**：3 个 API 容器（api-1, api-2, api-3）

**Nginx upstream**：

```nginx
upstream wm_api {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}
server {
    listen 443 ssl;
    location /api/ {
        proxy_pass http://wm_api;
        # 现有 proxy_set_header 配置保留
    }
}
```

**负载均衡**：round-robin

**优雅停机**：NestJS app.enableShutdownHooks() + SIGTERM handler：

1. 收到 SIGTERM → Nest 标记为 shutting down
2. 拒绝新请求（health 检查返回 503）
3. 等待进行中请求完成（最多 30s）
4. 退出进程

**健康检查**：Docker HEALTHCHECK（每 30s 检查 /api/health）

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

**自动重启**：Docker restart: always

**滚动升级**：

```bash
# 一次重启一个，保持 2/3 可用
for i in 1 2 3; do
    docker restart wm-card-api-$i
    sleep 30  # 等待新实例 health 通过
done
```

**验收指标**：

- 单实例挂掉：API 仍可访问（2/3 存活）
- 滚动升级：零停机（curl 1000 次成功率 100%）
- 优雅停机：进行中请求不中断（无 502 错误）

**实现文件**：

- 新增 `deploy/nginx/wm-api-upstream.conf`
- 修改 `apps/api/src/main.ts`（enableShutdownHooks + SIGTERM）
- 新增 `deploy/docker/api-instance.yml`（3 实例编排）

**风险**：

- 多实例 → 数据库连接池要调小（默认 9 × 3 = 27，可能超 MySQL max_connections）
- 共享 session 状态（refresh cookie 已无状态，无影响）
- 文件上传/长请求 → 需要限流防单实例阻塞

---

## 跨里程碑共同点

**可观测性**：每个里程碑都有 Prometheus 指标

- M1：cache_hits_total / cache_misses_total
- M2：sentry_events_sent_total
- M3：api_instance_health / request_count_per_instance

**回滚预案**：

- M1：Redis 关 → 直接读 DB（性能降但功能正常）
- M2：Sentry init 开关（off 时不采集）
- M3：Nginx upstream 移除某实例即可下线

---

## 工作量估算

| 里程碑 | 后端   | 前端   | 部署/测试                     | 合计   |
| ------ | ------ | ------ | ----------------------------- | ------ |
| M1     | 2-3 天 | 0      | 1 天                          | 3-4 天 |
| M2     | 2 天   | 0.5 天 | 1 天                          | 3-4 天 |
| M3     | 1 天   | 0      | 2 天（nginx 配置 + 滚动演练） | 3 天   |

合计：约 2 周密集开发 + 1 周稳定性观察 = 3 周

---

## 推荐启动顺序

按依赖关系：M1 → M2 → M3

- M1 先做（基础设施）
- M2 在 M1 后做（能看到缓存命中率在 Sentry 表现）
- M3 最后做（基础设施稳定后做水平扩展）

每个里程碑完成后：

1. 部署到生产（Z 节奏：全量闭环）
2. 观察 1 周（看 Sentry 告警 / cache 命中率 / API 错误率）
3. 开始下一个里程碑

---

## 待 grill 项

M1 写穿透有失败容忍问题，需要确认：

- Redis 写失败时，是否接受短暂缓存不一致（DB 是源）
- 还是需要双写容错（Redis 写失败时同步重试 N 次）

确认后开始 M1。
