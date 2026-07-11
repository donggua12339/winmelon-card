# ============================================================
# WM API - 多阶段构建
# Stage 1: 依赖安装 + 编译
# Stage 2: 仅产物 + node 用户运行
# ============================================================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# 复制 workspace 配置
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

# 安装依赖（包含 dev 依赖以编译）
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# 复制源码
COPY . .

# 生成 Prisma Client
RUN npm --workspace @wm-card/api run prisma:generate

# 构建
RUN npm --workspace @wm-card/shared-types run build
RUN npm --workspace @wm-card/api run build

# ============================================================
# Stage 2: 生产镜像
# ============================================================
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# 安全：以非 root 用户运行
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types ./packages/shared-types

# 安装仅 production 依赖
RUN npm ci --omit=dev --no-audit --no-fund || true

# Prisma Client 已在 builder 阶段生成，确保可被运行时访问
RUN mkdir -p /app/apps/api/node_modules/.prisma && \
    chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
