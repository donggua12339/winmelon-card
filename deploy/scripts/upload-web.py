#!/usr/bin/env python3
"""Upload web dist to production server."""
import os
import sys
import importlib.util

spec = importlib.util.spec_from_file_location('ssh_tool', os.path.join(os.path.dirname(__file__), 'ssh-tool.py'))
ssh_tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ssh_tool)
connect = ssh_tool.connect
exec_cmd = ssh_tool.exec_cmd

client = connect()
sftp = client.open_sftp()

local_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'web', 'dist'))
remote_dir = '/var/www/winmelon.cn'

uploaded = 0
for root, dirs, files in os.walk(local_dir):
    for f in files:
        local_path = os.path.join(root, f)
        rel_path = os.path.relpath(local_path, local_dir).replace(os.sep, '/')
        remote_path = f'{remote_dir}/{rel_path}'
        remote_dirname = os.path.dirname(remote_path).replace(os.sep, '/')
        try:
            sftp.stat(remote_dirname)
        except FileNotFoundError:
            exec_cmd(client, f'mkdir -p {remote_dirname}')
        sftp.put(local_path, remote_path)
        uploaded += 1
        print(f'[{uploaded}] {rel_path}')

sftp.close()
print(f'\nTotal uploaded: {uploaded} files')