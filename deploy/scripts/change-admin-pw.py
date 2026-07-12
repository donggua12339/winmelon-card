#!/usr/bin/env python3
"""改容器内 admin 密码 + 验证登录（用 docker cp 传文件避开 shell 转义）"""
import paramiko
import secrets
import string
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '162.251.93.5'
USER = 'root'
PASSWORD = 'lPdUNddxLzhbQr21'

def gen_password(length=16):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def ssh_exec(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

new_pw = gen_password(16)
print(f'=== C1: 改管理员密码 ===')
print(f'新密码: {new_pw}')
print(f'请妥善保存！\n')

# 1. 生成 bcrypt hash
cmd_hash = """docker exec wm-card-api-prod node -e 'const b=require("bcrypt"); b.hash(process.argv[1],12).then(h=>{process.stdout.write(h);process.exit(0)})' cNuoO8S3mj3fNdnh 2>/dev/null | tail -1"""
# 上面传了旧密码做演示，重新生成
cmd_hash_new = f"""docker exec wm-card-api-prod node -e 'const b=require(\"bcrypt\"); b.hash(\"{new_pw}\",12).then(h=>{{process.stdout.write(h);process.exit(0)}})' 2>&1 | tail -1"""
_, hash_out, _ = ssh_exec(client, cmd_hash_new, timeout=60)
# 清理 hash（可能有 ANSII 颜色码）
import re
hash_out = re.sub(r'\x1b\[[0-9;]*m', '', hash_out)
print(f'Hash: {hash_out[:30]}...{hash_out[-10:]}')

# 2. 创建更新脚本（用文件方式避免 shell 转义）
update_js = f'''
const {{ PrismaClient }} = require('@prisma/client');
const bcrypt = require('bcrypt');
(async () => {{
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('{new_pw}', 12);
  const result = await prisma.user.update({{
    where: {{ username: 'admin' }},
    data: {{ passwordHash: hash }},
  }});
  console.log('Updated:', result.username);
  await prisma.$disconnect();
}})().catch(e => {{ console.error(e); process.exit(1); }});
'''

# 写文件到容器（用 sftp）
sftp = client.open_sftp()
sftp.putfo(__import__('io').BytesIO(update_js.encode()), '/tmp/update-pw.cjs')
sftp.close()
print('脚本已上传')

# 在容器内运行
# 复制到 /app 目录（那里有 node_modules）
ssh_exec(client, 'docker cp /tmp/update-pw.cjs wm-card-api-prod:/app/update-pw.cjs')
_, run_out, run_err = ssh_exec(client, 'docker exec -w /app wm-card-api-prod node update-pw.cjs 2>&1 | tail -5', timeout=60)
print(f'更新结果: {run_out}')
if run_err:
    print(f'错误: {run_err[:300]}')

# 3. 验证新密码登录（API）
verify_cmd = f"""curl -s -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{{"username":"admin","password":"{new_pw}"}}' | head -c 300"""
_, verify_out, _ = ssh_exec(client, verify_cmd, timeout=15)
print(f'\n本机登录: {verify_out[:200]}')

# 4. 公网登录
pub_cmd = f"""curl -s -X POST https://winmelon.cn/api/auth/login -H 'Content-Type: application/json' -d '{{"username":"admin","password":"{new_pw}"}}' | head -c 300"""
_, pub_out, _ = ssh_exec(client, pub_cmd, timeout=20)
print(f'公网登录: {pub_out[:200]}')

# 5. 同步更新 .env.prod
update_env = f"""sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD={new_pw}|' /opt/wm-card/.env.prod && grep ADMIN_PASSWORD /opt/wm-card/.env.prod"""
_, env_out, _ = ssh_exec(client, update_env)
print(f'ENV 同步: {env_out}')

# 6. 清理
ssh_exec(client, 'rm -f /tmp/update-pw.cjs; docker exec wm-card-api-prod rm -f /tmp/update-pw.cjs')

client.close()
print('\n=== 验证完毕 ===')
print(f'\n🔐 新管理员密码: {new_pw}')
print('请立即保存到密码管理器！')
