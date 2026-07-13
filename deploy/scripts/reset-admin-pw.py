#!/usr/bin/env python3
"""重置管理员密码为固定值 Admin@2026!"""
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '162.251.93.5'
USER = 'root'
PASSWORD = 'lPdUNddxLzhbQr21'
NEW_PW = 'Admin@2026!'

def ssh_exec(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

print(f'=== 重置管理员密码 ===')
print(f'新密码: {NEW_PW}')

# 写更新脚本到容器
update_js = f'''
const {{ PrismaClient }} = require('@prisma/client');
const bcrypt = require('bcrypt');
(async () => {{
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash('{NEW_PW}', 12);
  const result = await prisma.user.update({{
    where: {{ username: 'admin' }},
    data: {{ passwordHash: hash }},
  }});
  console.log('OK:', result.username);
  await prisma.$disconnect();
}})().catch(e => {{ console.error('ERR:', e.message); process.exit(1); }});
'''

sftp = client.open_sftp()
sftp.putfo(__import__('io').BytesIO(update_js.encode()), '/tmp/update-pw.cjs')
sftp.close()
ssh_exec(client, 'docker cp /tmp/update-pw.cjs wm-card-api-prod:/app/update-pw.cjs')
_, run_out, run_err = ssh_exec(client, 'docker exec -w /app wm-card-api-prod node update-pw.cjs 2>&1 | tail -3', timeout=60)
print(f'更新: {run_out}')

# 验证登录
verify_cmd = f"""curl -s -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{{"username":"admin","password":"{NEW_PW}"}}' | head -c 400"""
_, verify_out, _ = ssh_exec(client, verify_cmd, timeout=15)
print(f'登录验证: {verify_out[:300]}')

# 同步 .env
ssh_exec(client, f"""sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD={NEW_PW}|' /opt/wm-card/.env.prod""")

# 清理
ssh_exec(client, 'docker exec wm-card-api-prod rm -f /app/update-pw.cjs')

client.close()
print(f'\n完成。新密码: {NEW_PW}')