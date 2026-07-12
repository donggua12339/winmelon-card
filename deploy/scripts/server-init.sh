#!/usr/bin/env bash
# ============================================================
# WM Card 服务器初始化脚本
# 在全新 Ubuntu/Debian 服务器上以 root 运行
# 用法：bash server-init.sh
# ============================================================
set -euo pipefail

log() { echo "[server-init] $*"; }
err() { echo "[server-init][ERROR] $*" >&2; exit 1; }

# 必须以 root 运行
[ "$(id -u)" -eq 0 ] || err "请以 root 运行此脚本"

# 检测包管理器
if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
elif command -v yum >/dev/null 2>&1; then
    PKG_MGR="yum"
else
    err "不支持的系统（需 apt 或 yum）"
fi

log "=== 1. 系统更新 ==="
if [ "$PKG_MGR" = "apt" ]; then
    apt-get update -y
    apt-get upgrade -y
else
    yum update -y
fi

log "=== 2. 安装基础工具 ==="
if [ "$PKG_MGR" = "apt" ]; then
    apt-get install -y curl wget git vim ufw fail2ban ca-certificates gnupg lsb-release
else
    yum install -y curl wget git vim ufw fail2ban ca-certificates gnupg
fi

log "=== 3. 配置防火墙（ufw）==="
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
# SSH（先放行，避免锁死自己）
ufw allow 22/tcp
# HTTP / HTTPS
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "防火墙已启用，仅放行 22/80/443"

log "=== 4. 配置 fail2ban（防 SSH 爆破）==="
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
banaction = ufw

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF
systemctl enable fail2ban
systemctl restart fail2ban
log "fail2ban 已启用，SSH 3 次失败封 2 小时"

log "=== 5. SSH 安全加固 ==="
SSHD_CONFIG="/etc/ssh/sshd_config"
# 备份
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak.$(date +%s)"

# 禁用 root 密码登录（保留 Key 登录）
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CONFIG"
# 禁用密码登录（仅 Key）
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
# 禁用空密码
sed -i 's/^#\?PermitEmptyPasswords.*/PermitEmptyPasswords no/' "$SSHD_CONFIG"
# 限制最大尝试次数
sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' "$SSHD_CONFIG"
# 禁用 X11 转发
sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' "$SSHD_CONFIG"

systemctl reload sshd || systemctl reload ssh
log "SSH 已加固：仅 Key 登录，禁用密码"

log "=== 6. 安装 Docker ==="
if ! command -v docker >/dev/null 2>&1; then
    log "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker 已安装"
else
    log "Docker 已存在，跳过"
fi

log "=== 7. 安装 Docker Compose ==="
if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    COMPOSE_VERSION="2.29.7"
    curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    log "docker-compose v${COMPOSE_VERSION} 已安装"
else
    log "Docker Compose 已存在，跳过"
fi

log "=== 8. 创建部署目录 ==="
mkdir -p /opt/wm-card
mkdir -p /opt/wm-card/ssl
mkdir -p /opt/wm-card/backups
mkdir -p /var/www/certbot
log "目录已创建：/opt/wm-card"

log "=== 9. 配置定时任务 ==="
# 每日凌晨 3 点备份 MySQL
( crontab -l 2>/dev/null; echo "0 3 * * * /opt/wm-card/deploy/scripts/backup.sh >> /opt/wm-card/backups/backup.log 2>&1" ) | crontab -
log "MySQL 备份定时任务已添加（每日 03:00）"

# 每周日凌晨 4 点清理 Docker 悬挂镜像
( crontab -l 2>/dev/null; echo "0 4 * * 0 docker image prune -f >> /dev/null 2>&1" ) | crontab -

log ""
log "=========================================="
log "服务器初始化完成 ✓"
log "=========================================="
log ""
log "下一步："
log "1. 在本地生成 SSH Key：ssh-keygen -t ed25519 -C 'admin@wm-card'"
log "2. 把公钥上传到服务器：ssh-copy-id root@<IP>"
log "3. 验证 Key 登录：ssh -i ~/.ssh/id_ed25519 root@<IP>"
log "4. 上传项目到 /opt/wm-card"
log "5. 运行 deploy.sh 部署"
