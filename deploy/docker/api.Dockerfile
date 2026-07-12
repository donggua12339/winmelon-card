# ============================================================
# WM API - 多阶段构建
# Stage 1: 依赖安装 + 编译
# Stage 2: 仅产物 + node 用户运行
# ============================================================
FROM node:20-bookworm AS builder
WORKDIR /app

# Prisma 需要 openssl + ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# 复制 workspace 配置
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

# 安装依赖（必须用 development 才能装 nest CLI / typescript）
ENV NODE_ENV=development
# --ignore-scripts 防止 @prisma/client postinstall 覆盖我们 prebuilt 的 .prisma
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps --ignore-scripts

# 复制源码
COPY . .

# 使用预生成的 Prisma Client（绕过 builder 中的 openssl 检测 bug）
COPY apps/api/prebuilt-prisma/.prisma /app/node_modules/.prisma
# swagger 8.1.1（兼容 nestjs 10，npm ci 在 builder 容器里没自动装）
COPY apps/api/prebuilt-prisma/node_modules/@nestjs/swagger /app/node_modules/@nestjs/swagger

# 构建
RUN npm --workspace @wm-card/shared-types run build
RUN npm --workspace @wm-card/api run build

# ============================================================
# Stage 2: 生产镜像
# ============================================================
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production

# Prisma 运行时需要 openssl；wget 用于健康检查
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

# 安全：以非 root 用户运行
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs

# 仅复制生产必要文件（npm workspaces 的 node_modules 在根目录）
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types

# 设置权限
RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
