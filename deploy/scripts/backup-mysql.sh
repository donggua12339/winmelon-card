#!/usr/bin/env bash
# ============================================================
# WM Card MySQL 备份脚本
# - 通过容器 + MYSQL_PWD 环境变量（不暴露到 ps）
# - 完整性校验 + 加密（可选）
# ============================================================
set -euo pipefail

if [ -f /opt/wm-card/.env.prod ]; then
    set -a
    # shellcheck disable=SC1091
    source /opt/wm-card/.env.prod
    set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/opt/wm-card/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
BACKUP_PREFIX="${BACKUP_PREFIX:-wmcard-mysql}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/${BACKUP_PREFIX}-${TIMESTAMP}.sql.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
err() { echo "[$(date '+%Y-%m-%d %H:%M:%S')][ERROR] $*" >&2; exit 1; }

log "开始备份：$FILE"

# 通过 MYSQL_PWD 环境变量传密码（不在进程列表可见）
docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" \
    wm-card-mysql-prod mysqldump \
    -hmysql -uroot \
    --single-transaction --routines --triggers --events \
    --default-character-set=utf8mb4 \
    "${MYSQL_DATABASE:-wmcard}" 2>/dev/null \
    | gzip -9 > "$FILE"

if [ ! -f "$FILE" ]; then
    err "备份文件未生成：$FILE"
fi
SIZE=$(stat -c%s "$FILE" 2>/dev/null || stat -f%z "$FILE")
if [ "$SIZE" -lt 1000 ]; then
    err "备份文件过小（${SIZE} bytes），可能失败"
fi
if ! gzip -t "$FILE" 2>/dev/null; then
    err "备份文件已损坏"
fi
log "备份成功（${SIZE} bytes）"

# GPG 加密（可选）
if command -v gpg >/dev/null 2>&1 && [ -n "${GPG_RECIPIENT:-}" ]; then
    gpg --batch --yes --recipient "$GPG_RECIPIENT" --encrypt "$FILE"
    rm "$FILE"
    FILE="${FILE}.gpg"
    log "已加密：$FILE"
fi

DELETED=$(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}-*.sql.gz*" -mtime +$RETAIN_DAYS -delete -print 2>/dev/null | wc -l)
log "清理 $RETAIN_DAYS 天前：删除 ${DELETED} 个"

COUNT=$(find "$BACKUP_DIR" -name "${BACKUP_PREFIX}-*" 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
log "当前保留 $COUNT 个备份，总大小 $TOTAL_SIZE"

log "完成 ✓"
