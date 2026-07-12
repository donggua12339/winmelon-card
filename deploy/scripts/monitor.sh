#!/usr/bin/env bash
# ============================================================
# WM Card 监控脚本（带邮件告警）
# ============================================================
set -uo pipefail

ENV_FILE="/opt/wm-card/.env.prod"
ALERT_LOG="/opt/wm-card/monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

LOG_TAIL_LINES="${LOG_TAIL_LINES:-100}"
DISK_THRESHOLD="${DISK_THRESHOLD:-85}"
MEM_THRESHOLD="${MEM_THRESHOLD:-85}"
API_TIMEOUT="${API_TIMEOUT:-10}"

mkdir -p "$(dirname "$ALERT_LOG")"

# 加载 env
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

ALERT_EMAIL="${ALERT_EMAIL:-}"
MAIL_USER="${MAIL_USER:-}"
MAIL_PASS="${MAIL_PASS:-}"

alert() {
    local msg="$1"
    local line="[$DATE] ALERT: $msg"
    echo "$line" >> "$ALERT_LOG"
    echo "$line" >&2

    # 邮件告警
    if [ -n "$ALERT_EMAIL" ] && [ -n "$MAIL_USER" ] && [ -n "$MAIL_PASS" ]; then
        local subject="[WM 告警] $msg"
        local body="$line\n\n服务器: $(hostname)\n时间: $DATE"
        # 用 python 发邮件（不依赖 mailx 配置）
        python3 -c "
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
try:
    msg = MIMEText('$body'.encode().decode('unicode_escape'), 'html', 'utf-8')
    msg['Subject'] = '''$subject'''
    msg['From'] = formataddr(('WM 监控', '$MAIL_USER'))
    msg['To'] = '$ALERT_EMAIL'
    s = smtplib.SMTP_SSL('smtp.qq.com', 465, timeout=15)
    s.login('$MAIL_USER', '$MAIL_PASS')
    s.sendmail('$MAIL_USER', ['$ALERT_EMAIL'], msg.as_string())
    s.quit()
    print('mail sent')
except Exception as e:
    print('mail fail:', e)
" 2>&1 | head -3 >> "$ALERT_LOG"
    fi
}

state="OK"
issues=()

# 1. 容器健康
for c in wm-card-mysql-prod wm-card-redis-prod wm-card-api-prod; do
    s=$(docker inspect --format='{{.State.Health.Status}}' "$c" 2>/dev/null || echo "missing")
    if [ "$s" != "healthy" ]; then
        state="CRITICAL"
        issues+=("容器 $c 状态：$s")
    fi
done

# 2. 磁盘
DISK=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')
if [ "$DISK" -gt "$DISK_THRESHOLD" ]; then
    state="WARNING"
    issues+=("磁盘使用率 ${DISK}% 超阈值 ${DISK_THRESHOLD}%")
fi

# 3. 内存
MEM=$(free | grep Mem | awk '{printf "%d", $3/$2*100}')
if [ "$MEM" -gt "$MEM_THRESHOLD" ]; then
    state="WARNING"
    issues+=("内存使用率 ${MEM}% 超阈值 ${MEM_THRESHOLD}%")
fi

# 4. API 健康
API_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" https://winmelon.cn/api/health || echo "000")
if [ "$API_HTTP" != "200" ]; then
    state="CRITICAL"
    issues+=("API HTTP $API_HTTP")
fi

# 5. SSL 证书
CERT_FILE="/www/server/panel/vhost/cert/winmelon.cn/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
    EXP=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
    EXP_EPOCH=$(date -d "$EXP" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    if [ "$EXP_EPOCH" -gt 0 ]; then
        DAYS=$(( (EXP_EPOCH - NOW_EPOCH) / 86400 ))
        if [ "$DAYS" -lt 30 ]; then
            state="WARNING"
            issues+=("SSL 证书剩 ${DAYS} 天过期")
        fi
    fi
fi

# 6. 备份
BACKUP_COUNT=$(find /opt/wm-card/backups -name "wmcard-mysql-*" 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -lt 1 ]; then
    state="WARNING"
    issues+=("没有任何备份")
fi

# 7. MySQL 连接（容器内 ping）
MYSQL_OK=$(docker exec -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" wm-card-mysql-prod \
    mysqladmin -hmysql -uroot ping 2>/dev/null || echo "fail")
if [[ "$MYSQL_OK" != *"alive"* ]]; then
    state="CRITICAL"
    issues+=("MySQL ping 失败")
fi

# 8. Redis 连接
REDIS_OK=$(docker exec wm-card-redis-prod redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null || echo "fail")
if [[ "$REDIS_OK" != *"PONG"* ]]; then
    state="CRITICAL"
    issues+=("Redis ping 失败")
fi

# --- 输出状态 ---
echo "[$DATE] 状态=$state 磁盘=${DISK}% 内存=${MEM}% API=$API_HTTP 备份=$BACKUP_COUNT"

# 触发告警
if [ "${#issues[@]}" -gt 0 ]; then
    for i in "${issues[@]}"; do
        alert "$i"
    done
fi

# 滚动日志
tail -n "$LOG_TAIL_LINES" "$ALERT_LOG" > /tmp/monitor.tail
mv /tmp/monitor.tail "$ALERT_LOG"

case "$state" in
    OK) exit 0 ;;
    WARNING) exit 1 ;;
    CRITICAL) exit 2 ;;
esac
