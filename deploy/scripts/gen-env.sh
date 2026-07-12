#!/usr/bin/env bash
# ============================================================
# 生成生产环境密钥并写入 .env.prod
# 用法：bash deploy/scripts/gen-env.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"

log() { echo "[gen-env] $*"; }

if [ -f "$ENV_FILE" ]; then
    read -p ".env.prod 已存在，覆盖？[y/N] " confirm
    [ "$confirm" = "y" ] || exit 0
fi

log "生成密钥..."
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -hex 32)
CARD_ENCRYPTION_KEY=$(openssl rand -base64 32)
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
MYSQL_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)

cat > "$ENV_FILE" <<EOF
# ============================================================
# WM Card 生产环境配置（自动生成，请勿提交到 git）
# 生成时间：$(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# ---------- 域名 ----------
DOMAIN=winmelon.cn

# ---------- 服务 ----------
NODE_ENV=production
PORT=3000
API_PREFIX=api
PUBLIC_BASE_URL=https://winmelon.cn
FRONTEND_URL=https://winmelon.cn
CORS_ORIGIN=https://winmelon.cn

# ---------- JWT ----------
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ---------- Session ----------
SESSION_SECRET=$SESSION_SECRET

# ---------- 卡密加密（AES-256-GCM，32 字节 base64）----------
CARD_ENCRYPTION_KEY=$CARD_ENCRYPTION_KEY

# ---------- 雪花 ID ----------
SNOWFLAKE_MACHINE_ID=1

# ---------- MySQL ----------
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_DATABASE=wmcard
MYSQL_USER=wmcard
MYSQL_PASSWORD=$MYSQL_PASSWORD

# ---------- Redis ----------
REDIS_PASSWORD=$REDIS_PASSWORD

# ---------- 管理员（首次 seed）----------
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_EMAIL=admin@winmelon.cn

# ---------- 日志 ----------
LOG_LEVEL=info
EOF

log "已生成 $ENV_FILE"
log ""
log "=========================================="
log "重要：请记下管理员密码"
log "=========================================="
log "管理员账号：admin"
log "管理员密码：$ADMIN_PASSWORD"
log ""
log "请妥善保管此密码，登录后台后请立即修改"
log ""
log "下一步："
log "1. 检查 $ENV_FILE 的 DOMAIN/PUBLIC_BASE_URL 是否正确"
log "2. 把此文件上传到服务器的 /opt/wm-card/.env.prod"
log "3. 在服务器运行 deploy/scripts/install.sh"
