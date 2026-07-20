#!/bin/sh
# WM Card 健康检查脚本 — 从 PORT 环境变量读端口，默认 3000
# Docker HEALTHCHECK CMD 指令不支持变量替换，用独立脚本解决
PORT=${PORT:-3000}
wget --quiet --tries=1 --spider http://localhost:${PORT}/api/health