# WM 官方虚拟卡密交易平台

> 开源发卡网 / 虚拟商品自动发卡平台

[![CI](https://github.com/OWNER/wm-card/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## 项目简介

WM 官方虚拟卡密交易平台是一个**开源发卡网系统**，专为个人开发者、小团队卖家设计，支持虚拟商品（卡密、激活码、账号、教程等）的自动交易与即时交付。

### 特性

- 自动发卡：付款后系统原子性取卡并发送给买家，零人工干预
- 多支付通道：易支付 / 微信 / 支付宝 / USDT 等（适配器模式，可插拔）
- 安全基线：源码完全开源后依然安全的设计假设
- 单商户自营 + 多商户入驻（V2）
- 路径式店铺访问 + 独立域名绑定（V3）

## 技术栈

| 层     | 选型                                      |
| ------ | ----------------------------------------- |
| 后端   | Node.js 20 + NestJS + TypeScript + Prisma |
| 前端   | Vue 3 + Vite + Element Plus + Pinia       |
| 数据库 | MySQL 8 + Redis 7                         |
| 部署   | Docker Compose + Nginx                    |

## 文档

- [架构设计](./ARCHITECTURE.md)
- [编码规范](./CODING-STANDARD.md)
- [安全基线](./SECURITY-BASELINE.md)
- [项目计划（原始规划）](./PROJECT-PLAN.md)
- [项目状态（当前进展）](./PROJECT-STATUS.md) ⭐ 维护中

## 当前状态

**M0-M3 + V2 已完成，V3 进行中。** 详见 [PROJECT-STATUS.md](./PROJECT-STATUS.md)。

- **部署地址**：https://winmelon.cn
- **API 文档**：https://winmelon.cn/api/docs
- **最新功能**：提现结算（P0）、开放 API、独立域名、USDT 支付、邮件通知、忘记密码

## 快速开始

### 环境要求

- Node.js ≥ 20 LTS
- npm ≥ 10
- Docker + Docker Compose（推荐）

### 本地开发

```bash
# 1. 克隆仓库
git clone <repo-url> wm-card
cd wm-card

# 2. 安装依赖
npm install

# 3. 准备环境变量
cp .env.example .env
# 编辑 .env，填入密钥（生成命令见文件内注释）

# 4. 启动 MySQL + Redis（Docker）
docker compose up -d mysql redis

# 5. 初始化数据库
npm --workspace @wm-card/api run prisma:migrate
npm --workspace @wm-card/api run prisma:seed

# 6. 启动开发服务器
npm run dev:api    # 后端 http://localhost:3000
npm run dev:web    # 前端 http://localhost:5173
```

### 一键启动（全 Docker）

```bash
cp .env.example .env
# 编辑 .env 填入密钥
docker compose up -d
```

## 项目结构

```
wm-card/
├── apps/
│   ├── api/          # NestJS 后端
│   └── web/          # Vue3 前端
├── packages/
│   └── shared-types/ # 前后端共享类型
├── deploy/
│   ├── nginx/
│   ├── docker/
│   └── scripts/
└── docs/
```

## 安全

详见 [SECURITY-BASELINE.md](./SECURITY-BASELINE.md)。

发现漏洞请按 [SECURITY.md](./SECURITY.md) 流程私下披露，**请勿直接提 issue**。

## 贡献

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

MIT
