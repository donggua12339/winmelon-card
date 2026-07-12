#!/usr/bin/env bash
# ============================================================
# WM Card 一键部署脚本（在服务器上运行）
# 前置：.env.prod 已配置，代码已上传到 /opt/wm-card
# 用法：bash deploy/scripts/install.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"
DOMAIN=""

log() { echo "[wm-card] $*"; }
err() { echo "[wm-card][ERROR] $*" >&2; exit 1; }

cd "$ROOT_DIR"

# ---------- 1. 检查前置 ----------
[ -f "$ENV_FILE" ] || err "未找到 .env.prod，请先运行 deploy/scripts/gen-env.sh"

# 从 .env.prod 读取 DOMAIN
DOMAIN=$(grep -E "^DOMAIN=" "$ENV_FILE" | cut -d= -f2-)
[ -n "$DOMAIN" ] || err "DOMAIN 未配置"

# 校验关键密钥
check_env() {
    local key="$1"
    local val
    val=$(grep -E "^${key}=" "$ENV_FILE" | cut -d= -f2-)
    [ -n "$val" ] || err "环境变量 $key 未设置"
}

log "校验环境变量..."
for key in JWT_SECRET JWT_REFRESH_SECRET CARD_ENCRYPTION_KEY \
           MYSQL_ROOT_PASSWORD MYSQL_PASSWORD REDIS_PASSWORD \
           ADMIN_PASSWORD DOMAIN; do
    check_env "$key"
done

# ---------- 2. 替换 Nginx 域名 ----------
log "配置 Nginx（域名：$DOMAIN）..."
sed -i "s|{{DOMAIN}}|$DOMAIN|g" "$ROOT_DIR/deploy/nginx/wm-card.conf"

# ---------- 3. 构建镜像 ----------
log "构建镜像..."
docker compose -f docker-compose.prod.yml build

# ---------- 4. 启动 MySQL/Redis ----------
log "启动数据库..."
docker compose -f docker-compose.prod.yml up -d mysql redis

log "等待 MySQL 就绪..."
for i in $(seq 1 60); do
    if docker exec wm-card-mysql-prod mysqladmin ping -h localhost \
        -u root -p"$(grep MYSQL_ROOT_PASSWORD "$ENV_FILE" | cut -d= -f2)" \
        --silent 2>/dev/null; then
        log "MySQL 就绪"
        break
    fi
    sleep 2
    [ "$i" -eq 60 ] && err "MySQL 启动超时"
done

# ---------- 5. 启动 API ----------
log "启动 API..."
docker compose -f docker-compose.prod.yml up -d api

log "等待 API 健康..."
for i in $(seq 1 30); do
    if docker exec wm-card-api-prod wget -q -O- http://localhost:3000/api/health 2>/dev/null; then
        log "API 健康检查通过"
        break
    fi
    sleep 2
    [ "$i" -eq 30 ] && {
        log "API 启动失败，查看日志："
        docker compose -f docker-compose.prod.yml logs api --tail 50
        err "API 启动超时"
    }
done

# ---------- 6. 数据库迁移 ----------
log "执行数据库迁移..."
docker exec wm-card-api-prod npx prisma migrate deploy --schema apps/api/prisma/schema.prisma \
    || err "数据库迁移失败"

# ---------- 7. Seed（仅首次）----------
log "检查是否需要初始化数据..."
SEED_DONE=$(docker exec wm-card-mysql-prod mysql \
    -u root -p"$(grep MYSQL_ROOT_PASSWORD "$ENV_FILE" | cut -d= -f2)" \
    -e "SELECT COUNT(*) FROM wmcard.merchants" -s 2>/dev/null || echo "0")

if [ "$SEED_DONE" = "0" ] || [ -z "$SEED_DONE" ]; then
    log "执行 seed..."
    docker exec -e DATABASE_URL="mysql://$(grep MYSQL_USER "$ENV_FILE" | cut -d= -f2):$(grep MYSQL_PASSWORD "$ENV_FILE" | cut -d= -f2)@mysql:3306/$(grep MYSQL_DATABASE "$ENV_FILE" | cut -d= -f2)" \
        wm-card-api-prod npx prisma db seed --schema apps/api/prisma/schema.prisma \
        || err "Seed 失败"
    log "Seed 完成"
else
    log "数据已存在，跳过 seed"
fi

# ---------- 8. 启动 Web ----------
log "启动 Web..."
docker compose -f docker-compose.prod.yml up -d web

# ---------- 9. TLS 证书 ----------
SSL_DIR="$ROOT_DIR/deploy/ssl"
if [ ! -f "$SSL_DIR/fullchain.pem" ]; then
    log "申请 Let's Encrypt 证书..."
    mkdir -p "$SSL_DIR"

    # 先用 HTTP 验证（需要 web 容器已启动）
    docker run --rm \
        -v "$SSL_DIR:/etc/letsencrypt" \
        -v "$ROOT_DIR/deploy/nginx/certbot:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        --non-interactive --agree-tos \
        -m "admin@$DOMAIN" \
        --no-eff-email \
        && {
            cp "$SSL_DIR/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
            cp "$SSL_DIR/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"
            log "证书已申请"
        } || log "证书申请失败，请手动运行 certbot"

    # 重载 Nginx
    docker exec wm-card-web-prod nginx -s reload || true
fi

# ---------- 10. 设置证书自动续期 ----------
log "配置证书自动续期..."
( crontab -l 2>/dev/null | grep -v certbot; \
  echo "0 3 * * * docker run --rm -v $SSL_DIR:/etc/letsencrypt -v $ROOT_DIR/deploy/nginx/certbot:/var/www/certbot certbot/certbot renew --quiet && docker exec wm-card-web-prod nginx -s reload" \
) | crontab -

# ---------- 11. 完成报告 ----------
ADMIN_PASSWORD=$(grep ADMIN_PASSWORD "$ENV_FILE" | cut -d= -f2)

log ""
log "=========================================="
log "部署完成 ✓"
log "=========================================="
log ""
log "站点：https://$DOMAIN"
log "后台：https://$DOMAIN/admin/login"
log "管理员：admin"
log "密码：$ADMIN_PASSWORD"
log ""
log "重要提醒："
log "1. 登录后台后立即修改管理员密码"
log "2. 在「支付配置」页填入易支付参数"
log "3. 在「系统配置」页编辑店铺信息"
log ""
log "常用命令："
log "  查看日志：docker compose -f docker-compose.prod.yml logs -f"
log "  重启服务：docker compose -f docker-compose.prod.yml restart"
log "  停止服务：docker compose -f docker-compose.prod.yml down"
log "  备份数据库：bash deploy/scripts/backup.sh"
