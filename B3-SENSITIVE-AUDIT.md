# B3:敏感信息审计报告

**审计日期**: 2026-07-21
**审计范围**: git history 中的硬编码密码 / 密钥

---

## 一、发现

### 1. ssh-tool.py 硬编码 root 密码

**文件**: `deploy/scripts/ssh-tool.py`
**引入 commit**: `476334c feat(m2-deploy): M2 上线到 winmelon.cn（混合部署）`
**密码**: `2fjBJJKUhr5yMRZc`（HK 服务器 root 密码）

```python
HOST = '162.251.93.199'
USER = 'root'
PASSWORD = '2fjBJJKUhr5yMRZc'
PORT = 22022
```

**影响**:

- 仓库 public（https://github.com/donggua12339/winmelon-card），任何人都可看到
- 攻击者可直连 SSH `162.251.93.199:22022` 用 root/密码登录
- 服务器上所有数据（WM 订单、SeekAll 用户、商户信息）面临泄露风险

### 2. 其他敏感信息扫描

| 类型                | 文件                  | 状态    |
| ------------------- | --------------------- | ------- |
| JWT_SECRET          | .env.prod（未入 git） | ✅ 安全 |
| CARD_ENCRYPTION_KEY | .env.prod（未入 git） | ✅ 安全 |
| WM_WEBHOOK_SECRET   | .env.prod（未入 git） | ✅ 安全 |
| MAIL_PASS           | .env.prod（未入 git） | ✅ 安全 |
| SENTRY_DSN          | .env.prod（未入 git） | ✅ 安全 |
| MySQL 密码          | .env.prod（未入 git） | ✅ 安全 |
| Redis 密码          | .env.prod（未入 git） | ✅ 安全 |

仅 `ssh-tool.py` 的 root 密码泄露。

---

## 二、修复方案

### 方案 A:立即修改服务器 root 密码（必做，优先级 P0）

1. SSH 登录服务器（用旧密码）
2. `passwd root` 修改为新强密码
3. 新密码不入 git，存到密码管理器（1Password / Bitwarden / KeePass）

### 方案 B:改用 SSH Key 认证（推荐，长期方案）

1. 本地生成 Ed25519 key：`ssh-keygen -t ed25519 -f ~/.ssh/wm-card-hk`
2. 上传公钥：`ssh-copy-id -i ~/.ssh/wm-card-hk.pub -p 22022 root@162.251.93.199`
3. 测试 key 登录：`ssh -i ~/.ssh/wm-card-hk -p 22022 root@162.251.93.199`
4. 禁用密码登录：编辑 `/etc/ssh/sshd_config` 设 `PasswordAuthentication no`
5. 重启 sshd：`systemctl restart sshd`
6. 修改 `ssh-tool.py` 用 key 认证：
   ```python
   client.connect(HOST, port=PORT, username=USER, key_filename='~/.ssh/wm-card-hk', timeout=30)
   ```

### 方案 C:清理 git history（破坏性，需用户确认）

用 BFG Repo-Cleaner 清理历史：

```bash
# 1. 备份仓库
git clone --mirror https://github.com/donggua12339/winmelon-card wm-card-mirror.git
cd wm-card-mirror.git

# 2. 用 BFG 替换密码
java -jar bfg.jar --replace-text passwords.txt wm-card-mirror.git
# passwords.txt 内容：2fjBJJKUhr5yMRZc

# 3. 清理 git gc
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. 强推（破坏性！）
git push --force
```

**风险**:

- 改写所有 commit hash
- 所有 clone 需要重新 clone
- 协作者需重新基于新 hash 工作

**建议**: 由于仓库是个人项目，协作者少，可以接受。但必须先做方案 A（改密码）+ 方案 B（key 认证），history 清理是锦上添花。

---

## 三、当前状态

- [x] 审计完成
- [ ] 服务器 root 密码已修改（待用户执行）
- [ ] SSH key 认证已配置（待用户执行）
- [ ] ssh-tool.py 改用 key 认证（待用户执行）
- [ ] git history 已清理（待用户决策）

---

## 四、建议执行顺序

1. **立即**：用户修改服务器 root 密码（方案 A）
2. **本周**：配置 SSH key 认证（方案 B）
3. **本周**：修改 `ssh-tool.py` 用 key 认证，提交 + push
4. **可选**：用 BFG 清理 git history（方案 C）

完成 1+2+3 后，泄露的密码已失效，git history 清理（方案 C）变为可选项（历史密码已无法登录）。
