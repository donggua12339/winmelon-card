#!/usr/bin/env bash
# ============================================================
# WM Card 监控脚本
# - 容器健康检查
# - 磁盘/内存/CPU
# - 证书有效期
# - API 健康检查
# - 超阈值写日志（可接告警 webhook）
# ============================================================
set -uo pipefail

ALERT_LOG="/opt/wm-card/monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

LOG_TAIL_LINES="${LOG_TAIL_LINES:-50}"
DISK_THRESHOLD="${DISK_THRESHOLD:-85}"
MEM_THRESHOLD="${MEM_THRESHOLD:-85}"
API_TIMEOUT="${API_TIMEOUT:-10}"

mkdir -p "$(dirname "$ALERT_LOG")"

alert() {
    local msg="[$DATE] ALERT: $*"
    echo "$msg" >> "$ALERT_LOG"
    echo "$msg" >&2
    # 预留告警 webhook 接口
    # curl -sf -X POST "$ALERT_WEBHOOK" -d "{\"text\":\"$msg\"}" >/dev/null 2>&1 || true
}

state="OK"
issues=()

# 1. 容器健康
echo "=== 容器健康 ($DATE) ==="
for c in wm-card-mysql-prod wm-card-redis-prod wm-card-api-prod; do
    s=$(docker inspect --format='{{.State.Health.Status}}' "$c" 2>/dev/null || echo "missing")
    if [ "$s" != "healthy" ]; then
        state="CRITICAL"
        issues+=("容器 $c 状态：$s")
    fi
    echo "  $c: $s"
done

# 2. 磁盘
DISK=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')
echo "=== 磁盘 ==="
echo "  / 已用 ${DISK}%，剩余 ${DISK_FREE}"
if [ "$DISK" -gt "$DISK_THRESHOLD" ]; then
    state="WARNING"
    issues+=("磁盘使用率 ${DISK}% 超阈值")
    alert "磁盘使用率 ${DISK}% 超阈值（${DISK_THRESHOLD}%）"
fi

# 3. 内存
MEM=$(free | grep Mem | awk '{printf "%d", $3/$2*100}')
MEM_TOTAL=$(free -h | grep Mem | awk '{print $2}')
MEM_USED=$(free -h | grep Mem | awk '{print $3}')
echo "=== 内存 ==="
echo "  使用 ${MEM}% (${MEM_USED}/${MEM_TOTAL})"
if [ "$MEM" -gt "$MEM_THRESHOLD" ]; then
    state="WARNING"
    issues+=("内存使用率 ${MEM}% 超阈值")
    alert "内存使用率 ${MEM}% 超阈值（${MEM_THRESHOLD}%）"
fi

# 4. API 健康
API_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" https://winmelon.cn/api/health || echo "000")
echo "=== API ==="
echo "  /api/health: HTTP $API_HTTP"
if [ "$API_HTTP" != "200" ]; then
    state="CRITICAL"
    issues+=("API HTTP $API_HTTP")
    alert "API 健康检查失败 HTTP $API_HTTP"
fi

# 5. 证书有效期
CERT_FILE="/www/server/panel/vhost/cert/winmelon.cn/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
    EXP=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
    EXP_EPOCH=$(date -d "$EXP" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    if [ "$EXP_EPOCH" -gt 0 ]; then
        DAYS=$(( (EXP_EPOCH - NOW_EPOCH) / 86400 ))
        echo "=== SSL 证书 ==="
        echo "  到期: $EXP（剩 ${DAYS} 天）"
        if [ "$DAYS" -lt 30 ]; then
            state="WARNING"
            issues+=("证书剩 ${DAYS} 天过期")
            alert "SSL 证书将过期（剩 ${DAYS} 天）"
        fi
    fi
fi

# 6. 备份情况
BACKUP_COUNT=$(find /opt/wm-card/backups -name "wmcard-mysql-*" 2>/dev/null | wc -l)
BACKUP_NEWEST=$(find /opt/wm-card/backups -name "wmcard-mysql-*" -type f -printf '%T+ %p\n' 2>/dev/null | sort -r | head -1 | awk '{print $1}')
echo "=== 备份 ==="
echo "  备份数: $BACKUP_COUNT，最新: $BACKUP_NEWEST"
if [ "$BACKUP_COUNT" -lt 1 ]; then
    state="WARNING"
    issues+=("没有任何备份")
fi

echo "=== 总结 ==="
echo "  状态: $state"
if [ "${#issues[@]}" -gt 0 ]; then
    echo "  问题:"
    for i in "${issues[@]}"; do
        echo "    - $i"
    done
fi

# 输出日志（保留最近 50 行）
tail -n "$LOG_TAIL_LINES" "$ALERT_LOG" > /tmp/monitor.tail
mv /tmp/monitor.tail "$ALERT_LOG"

case "$state" in
    OK) exit 0 ;;
    WARNING) exit 1 ;;
    CRITICAL) exit 2 ;;
esac
