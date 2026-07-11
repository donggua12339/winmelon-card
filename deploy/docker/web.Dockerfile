# ============================================================
# WM Web - 静态产物 + Nginx
# ============================================================
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/

RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
RUN npm --workspace @wm-card/shared-types run build
RUN npm --workspace @wm-card/web run build

# ============================================================
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx/web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
