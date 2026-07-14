# ============================================================
# WM API - 多阶段构建（加固版）
# Stage 1: builder - 安装依赖 + 编译 + 校验产物
# Stage 2: runner  - 仅复制生产必要文件
# ============================================================
FROM node:20-bookworm AS builder
WORKDIR /app

# Prisma 运行时需要 openssl + ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# -------- 1. 复制 workspace 依赖清单（最大化缓存命中）--------
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

# -------- 2. 安装依赖（含 nest CLI 等 dev 工具）--------
ENV NODE_ENV=development
RUN npm install --include=dev --no-audit --no-fund --legacy-peer-deps

# -------- 3. 复制全部源码 --------
# 注意：prebuilt-prisma/ 已加入 .gitignore，本地不入库
# Docker build context 由 .dockerignore 控制（如果有）
COPY . .

# -------- 4. 容器内生成 Prisma Client --------
# 之前依赖 prebuilt-prisma 是为了规避"容器内 prisma generate 有 bug"
# 新方案：直接 generate，更可靠（无需提交 .prisma 到 git）
RUN cd /app/apps/api && \
    npx --no-install prisma generate --no-hints 2>&1 | tail -3

# -------- 5. 编译 shared-types + api --------
# 关键：先清 dist 和 tsbuildinfo 缓存，避免增量编译用旧缓存
RUN rm -rf /app/apps/api/dist /app/apps/api/tsconfig.build.tsbuildinfo /app/packages/shared-types/dist
RUN npm --workspace @wm-card/shared-types run build
RUN npm --workspace @wm-card/api run build

# 输出 build 时间戳用于诊断
RUN echo "--- dist build time ---" && stat /app/apps/api/dist/main.js | grep Modify

# -------- 6. POST-BUILD 校验：dist 必须包含关键新模块 + .prisma 完整 + 时间戳新鲜 --------
# 这是为了防止历史踩坑（dist 缺新模块 / Prisma enum 缺失但 build 不报错）
RUN set -e; \
    echo "--- post-build validation ---"; \
    for module in article page-view ticket invite notification merchant-payment-channel; do \
        if [ ! -f "/app/apps/api/dist/modules/$module/$module.controller.js" ]; then \
            echo "FATAL: dist/modules/$module/$module.controller.js missing"; \
            ls /app/apps/api/dist/modules/ 2>&1 | head -30; \
            exit 1; \
        else \
            echo "  ✓ dist/$module OK"; \
        fi; \
    done; \
    echo "--- main.js sanity ---"; \
    grep -q 'new ShopHostMiddleware\|new shop_host_middleware' /app/apps/api/dist/main.js || \
        (echo "FATAL: main.js looks outdated" && exit 1); \
    echo "  ✓ main.js OK"; \
    echo "--- prisma sanity ---"; \
    test -f /app/node_modules/.prisma/client/index.js && \
        grep -q 'ArticleType' /app/node_modules/.prisma/client/index.js || \
        (echo "FATAL: .prisma missing ArticleType" && exit 1); \
    echo "  ✓ .prisma OK"

# -------- 7. 裁剪 dev 依赖，减小生产镜像 --------
# @prisma/client 是 dependencies，prisma engine binaries 在 .prisma 目录，不受影响
RUN npm prune --omit=dev --legacy-peer-deps

# ============================================================
# Stage 2: 生产镜像（最小化）
# ============================================================
FROM node:20-bookworm AS runner
WORKDIR /app

ENV NODE_ENV=production

# Prisma 运行时需要 openssl；wget 用于健康检查
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates wget && rm -rf /var/lib/apt/lists/*

# 安全：以非 root 用户运行
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/false --create-home nodejs

# 复制生产必要文件（按大小从大到小，最大化层缓存命中）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/package.json /app/package-lock.json* ./

# 设置权限
RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]