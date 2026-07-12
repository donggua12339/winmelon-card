#!/usr/bin/env bash
# 生成 prebuilt-prisma 目录（Docker 构建时 COPY 进去用）
#
# 背景：Prisma 5.22 在 node:20-bookworm builder 容器里 `prisma generate`
#       产出的 client 缺模型（疑似 openssl 检测 bug）。
#       绕过办法：本地先 generate 好，把 .prisma 目录和 swagger 8 一起
#       COPY 到 builder 里，并加 --ignore-scripts 防止 @prisma/client
#       postinstall 覆盖。
#
# 用法：
#   cd <repo-root>
#   bash deploy/scripts/prepare-prebuilt-prisma.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "[1/3] 生成 Prisma Client（binaryTargets = native + debian-openssl-3.0.x）"
cd apps/api
npx prisma generate
cd "$ROOT"

echo "[2/3] 拷贝 .prisma 到 prebuilt-prisma/"
rm -rf apps/api/prebuilt-prisma/.prisma
mkdir -p apps/api/prebuilt-prisma
cp -r node_modules/.prisma apps/api/prebuilt-prisma/.prisma

echo "[3/3] 拷贝 @nestjs/swagger 到 prebuilt-prisma/"
rm -rf apps/api/prebuilt-prisma/node_modules/@nestjs/swagger
mkdir -p apps/api/prebuilt-prisma/node_modules/@nestjs
cp -r node_modules/@nestjs/swagger apps/api/prebuilt-prisma/node_modules/@nestjs/swagger

echo "完成。目录大小："
du -sh apps/api/prebuilt-prisma/
