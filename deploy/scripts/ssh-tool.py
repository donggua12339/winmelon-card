#!/usr/bin/env python3
"""
WM Card SSH 工具 - 用于远程服务器操作
用法：
  python ssh-tool.py exec "命令"
  python ssh-tool.py upload 本地文件 远程路径
  python ssh-tool.py script 脚本路径
"""
import sys
import os
import paramiko
from io import StringIO

# 修复 Windows GBK 编码问题
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST = '162.251.93.199'
USER = 'root'
PASSWORD = '2fjBJJKUhr5yMRZc'
PORT = 22022

def connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    return client

def exec_cmd(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    code = stdout.channel.recv_exit_status()
    return code, out, err

def upload(client, local, remote):
    sftp = client.open_sftp()
    sftp.put(local, remote)
    sftp.close()

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1]
    client = connect()

    try:
        if action == 'exec':
            cmd = sys.argv[2]
            code, out, err = exec_cmd(client, cmd)
            if out:
                print(out, end='')
            if err:
                print(err, end='', file=sys.stderr)
            sys.exit(code)
        elif action == 'upload':
            local, remote = sys.argv[2], sys.argv[3]
            upload(client, local, remote)
            print(f'uploaded: {local} -> {remote}')
        elif action == 'script':
            script_path = sys.argv[2]
            with open(script_path, 'r', encoding='utf-8') as f:
                content = f.read()
            code, out, err = exec_cmd(client, f'bash -s', timeout=600)
            # 用 stdin 传入脚本
            stdin, stdout, stderr = client.exec_command('bash -s', timeout=600)
            stdin.write(content)
            stdin.flush()
            stdin.channel.shutdown_write()
            out = stdout.read().decode('utf-8', errors='replace')
            err = stderr.read().decode('utf-8', errors='replace')
            code = stdout.channel.recv_exit_status()
            if out:
                print(out, end='')
            if err:
                print(err, end='', file=sys.stderr)
            sys.exit(code)
        elif action == 'test':
            print('=== SSH 连接测试 ===')
            code, out, _ = exec_cmd(client, 'hostname && uname -a')
            print(f'主机名: {out.strip()}')

            code, out, _ = exec_cmd(client, 'cat /etc/os-release | grep -E "^(NAME|VERSION)="')
            print(f'系统: {out.strip()}')

            code, out, _ = exec_cmd(client, 'nproc && free -h | head -2 && df -h / | tail -1')
            print(f'资源:\n{out}')

            code, out, _ = exec_cmd(client, 'which docker && docker --version || echo "docker: 未安装"')
            print(f'Docker: {out.strip()}')

            code, out, _ = exec_cmd(client, 'which nginx || echo "nginx: 未安装"')
            print(f'Nginx: {out.strip()}')

            code, out, _ = exec_cmd(client, 'ufw status 2>/dev/null || echo "ufw: 未安装"')
            print(f'防火墙: {out.strip()}')

            print('\n✓ SSH 连接正常')
        else:
            print(f'未知操作: {action}')
            sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()
