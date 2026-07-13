<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';

const router = useRouter();
const auth = useAuthStore();

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  await auth.logout();
  router.replace('/admin/login');
}
</script>

<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="aside">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text"> <span class="text-gradient-aurora">WM</span> Card </span>
      </div>
      <el-menu router default-active="/admin/dashboard" class="side-menu">
        <el-menu-item index="/admin/dashboard">
          <span>📊</span>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/admin/products">
          <span>📦</span>
          <span>商品管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/stock">
          <span>🔑</span>
          <span>卡密管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/orders">
          <span>🛒</span>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/payments">
          <span>💳</span>
          <span>支付配置</span>
        </el-menu-item>
        <el-menu-item index="/admin/system">
          <span>⚙️</span>
          <span>系统配置</span>
        </el-menu-item>
        <el-menu-item index="/admin/audit-logs">
          <span>📋</span>
          <span>审计日志</span>
        </el-menu-item>
        <el-menu-item index="/admin/stats">
          <span>📈</span>
          <span>高级统计</span>
        </el-menu-item>
        <el-menu-item index="/admin/risk">
          <span>🛡️</span>
          <span>行为风控</span>
        </el-menu-item>
        <el-menu-item index="/admin/merchant-applications">
          <span>🏪</span>
          <span>商户审核</span>
        </el-menu-item>
        <el-menu-item index="/admin/api-keys">
          <span>🔑</span>
          <span>API Key</span>
        </el-menu-item>
        <el-menu-item index="/admin/domain">
          <span>🌐</span>
          <span>自定义域名</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 主区 -->
    <el-container>
      <el-header class="header">
        <div class="left">
          <RouterLink to="/" class="back">← 返回首页</RouterLink>
        </div>
        <div class="right">
          <span class="user-info">
            <span class="user-avatar">{{ auth.user?.username?.[0]?.toUpperCase() ?? 'A' }}</span>
            <span class="user-name">{{ auth.user?.username ?? '-' }}</span>
          </span>
          <el-button link type="danger" @click="onLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

/* 侧边栏 */
.aside {
  background: var(--wm-bg-deep);
  border-right: 1px solid var(--wm-border-glass);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid var(--wm-border-glass);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.logo-icon {
  font-size: 24px;
}

.side-menu {
  padding: 12px 0;
  border-right: none;
}

.side-menu :deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
  margin: 4px 12px;
  border-radius: var(--wm-radius-md);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--wm-text-secondary);
  transition: all 0.3s ease;
}

.side-menu :deep(.el-menu-item:hover) {
  background: var(--wm-glass-bg);
  color: var(--wm-text-primary);
}

.side-menu :deep(.el-menu-item.is-active) {
  background: var(--wm-gradient-primary);
  color: white;
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

/* 顶部 */
.header {
  background: var(--wm-glass-bg);
  backdrop-filter: blur(var(--wm-glass-blur));
  border-bottom: 1px solid var(--wm-border-glass);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 64px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.back {
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.3s ease;
}

.back:hover {
  color: var(--wm-accent-cyan);
}

.right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--wm-gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(124, 58, 237, 0.3);
}

.user-name {
  color: var(--wm-text-primary);
  font-size: 14px;
  font-weight: 500;
}

/* 主区 */
.main {
  padding: 24px;
}
</style>
