<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';

const router = useRouter();
const auth = useAuthStore();
const themeColor = computed(() => auth.merchantThemeColor ?? '#7c3aed');

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  await auth.logout();
  router.replace('/admin/login');
}
</script>

<template>
  <div class="merchant-layout" :style="{ '--theme-color': themeColor }">
    <!-- 顶部品牌栏 -->
    <header class="topbar">
      <div class="brand">
        <span class="brand-icon">🏪</span>
        <span class="brand-text">商户工作台</span>
        <span class="brand-divider">·</span>
        <span class="merchant-name">{{ auth.merchantName || auth.user?.username || '加载中...' }}</span>
      </div>
      <div class="topbar-right">
        <el-button size="small" @click="router.push('/')">查看店铺</el-button>
        <span class="user-info">{{ auth.user?.username }}</span>
        <el-button link size="small" @click="onLogout">退出</el-button>
      </div>
    </header>

    <div class="container">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <el-menu router :default-active="$route.path" class="side-menu">
          <el-menu-item index="/merchant/dashboard">
            <span>📊</span>
            <span>数据看板</span>
          </el-menu-item>
          <el-menu-item index="/merchant/products">
            <span>📦</span>
            <span>商品管理</span>
          </el-menu-item>
          <el-menu-item index="/merchant/stock">
            <span>🔑</span>
            <span>卡密管理</span>
          </el-menu-item>
          <el-menu-item index="/merchant/orders">
            <span>🛒</span>
            <span>订单管理</span>
          </el-menu-item>
          <el-menu-item index="/merchant/api-keys">
            <span>🔐</span>
            <span>API Key</span>
          </el-menu-item>
          <el-menu-item index="/merchant/domain">
            <span>🌐</span>
            <span>自定义域名</span>
          </el-menu-item>
          <el-menu-item index="/merchant/settings">
            <span>⚙️</span>
            <span>账户设置</span>
          </el-menu-item>
        </el-menu>
      </aside>

      <!-- 主区 -->
      <main class="main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.merchant-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.topbar {
  height: 56px;
  padding: 0 24px;
  background: var(--theme-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.brand-icon {
  font-size: 22px;
}

.brand-divider {
  margin: 0 4px;
  opacity: 0.6;
}

.merchant-name {
  font-weight: 500;
  opacity: 0.95;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-right :deep(.el-button) {
  color: white;
}

.user-info {
  font-size: 13px;
  opacity: 0.9;
  padding: 0 8px;
}

.container {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid var(--el-border-color-lighter);
  padding: 16px 0;
}

.side-menu {
  border-right: none;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>
