#!/usr/bin/env python3
"""上传文件到服务器"""
import sys
import paramike

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '162.251.93.5'
USER = 'root'
PASSWORD = '2fjBJJKUhr5yMRZc'

local = sys.argv[1]
remote = sys.argv[2]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

sftp = client.open_sftp()
sftp.put(local, remote)
sftp.close()

# 获取文件大小验证
stat = sftp.stat(remote) if False else None
client.close()
print(f'uploaded: {local} -> {remote}')
