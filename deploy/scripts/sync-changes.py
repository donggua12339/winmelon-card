#!/usr/bin/env python3
"""Sync changed files to /opt/wm-card/ via SSH."""
import os
import sys
import importlib.util

spec = importlib.util.spec_from_file_location('ssh_tool', os.path.join(os.path.dirname(__file__), 'ssh-tool.py'))
ssh_tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ssh_tool)

client = ssh_tool.connect()
sftp = client.open_sftp()

ROOT = r'D:\soft\wm-card'
REMOTE_ROOT = '/opt/wm-card'

# M3 + main.ts (优雅停机)
files = [
    'apps/api/src/main.ts',
    'deploy/nginx/wm-api-upstream.conf',
    'deploy/scripts/rolling-restart.sh',
]

uploaded = 0
for f in files:
    local = os.path.join(ROOT, f)
    if not os.path.exists(local):
        print(f'SKIP missing: {f}')
        continue
    remote = f'{REMOTE_ROOT}/{f.replace(os.sep, "/")}'
    remote_dir = os.path.dirname(remote).replace(os.sep, '/')
    ssh_tool.exec_cmd(client, f'mkdir -p {remote_dir}')
    sftp.put(local, remote)
    print(f'PUT {f}')
    uploaded += 1

sftp.close()
print(f'\nTotal uploaded: {uploaded} files')
