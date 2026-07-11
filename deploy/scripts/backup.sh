#!/usr/bin/env bash
# MySQL 备份脚本
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/data/backups}"
RETAIN_DAYS=${RETAIN_DAYS:-14}
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-wmcard}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/${MYSQL_DATABASE}-${TIMESTAMP}.sql.gz"

log() { echo "[backup] $*"; }

log "备份开始：$FILE"
docker exec wm-card-mysql-prod mysqldump \
    -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_ROOT_PASSWORD" \
    --single-transaction --routines --triggers --events \
    "$MYSQL_DATABASE" 2>/dev/null | gzip > "$FILE"

# 加密（如有 GPG）
if command -v gpg >/dev/null 2>&1 && [ -n "${GPG_RECIPIENT:-}" ]; then
    gpg --batch --yes --recipient "$GPG_RECIPIENT" --encrypt "$FILE"
    rm "$FILE"
    log "已加密：$FILE.gpg"
fi

log "清理 $RETAIN_DAYS 天前的备份..."
find "$BACKUP_DIR" -name "${MYSQL_DATABASE}-*.sql.gz*" -mtime +$RETAIN_DAYS -delete

log "备份完成 ✓"
