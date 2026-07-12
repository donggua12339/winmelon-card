#!/usr/bin/env python3
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('162.251.93.5', username='root', password='lPdUNddxLzhbQr21', timeout=30)
sftp = client.open_sftp()
sftp.put('deploy/docker/api.Dockerfile', '/opt/wm-card/deploy/docker/api.Dockerfile')
sftp.close()
cmd = 'cd /opt/wm-card && nohup bash -c "docker compose -f docker-compose.prod.yml build --no-cache api > /opt/wm-card/build10.log 2>&1 && echo BUILD10_DONE >> /opt/wm-card/build10.log" &disown'
i, o, e = client.exec_command(cmd, timeout=15)
print('OUT:', o.read().decode())
client.close()
print('build v10 started')
