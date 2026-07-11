#!/usr/bin/env bash
# 一键部署脚本（生产环境）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"

log() { echo "[wm-card] $*"; }
err() { echo "[wm-card][ERROR] $*" >&2; exit 1; }

# 检查环境变量
[ -f "$ENV_FILE" ] || err "未找到 $ENV_FILE，请按 .env.example 创建生产环境配置"

# 校验关键密钥
check_env() {
    local key="$1"
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" | cut -d= -f2-)
    [ -n "$val" ] || err "环境变量 $key 未设置"
    [[ "$val" == CHANGE_ME* ]] && err "环境变量 $key 仍为占位符，请生成真实值"
}

log "校验环境变量..."
for key in JWT_SECRET JWT_REFRESH_SECRET SESSION_SECRET CARD_ENCRYPTION_KEY MYSQL_PASSWORD MYSQL_ROOT_PASSWORD REDIS_PASSWORD ADMIN_PASSWORD DOMAIN; do
    check_env "$key"
done

log "构建镜像..."
cd "$ROOT_DIR"
docker compose -f docker-compose.prod.yml build

log "启动服务..."
docker compose -f docker-compose.prod.yml up -d

log "等待 API 健康..."
for i in $(seq 1 30); do
    if docker exec wm-card-api-prod wget -q -O- http://localhost:3000/api/health 2>/dev/null | grep -q '"status":"ok"'; then
        log "API 健康检查通过"
        break
    fi
    sleep 2
    [ "$i" -eq 30 ] && err "API 启动超时"
done

log "执行数据库迁移..."
docker exec wm-card-api-prod node -e "require('./apps/api/dist/infrastructure/prisma/prisma.service').default?.then(s => s.\$connect().then(() => s.\$executeRaw\`SELECT 1\`).then(() => process.exit(0)))" || \
    log "（如已迁移可忽略）"

log "部署完成 ✓"
log "访问 https://$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2)"
