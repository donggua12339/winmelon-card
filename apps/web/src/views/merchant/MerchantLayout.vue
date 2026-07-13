<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';

const router = useRouter();
const auth = useAuthStore();
const themeColor = computed(() => auth.merchantThemeColor ?? '#6366f1');

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  await auth.logout();
  router.replace('/admin/login');
}

function onChangePassword(): void {
  router.push('/merchant/change-password');
}

const menuItems = [
  { path: '/merchant/dashboard', icon: '📊', label: '数据看板' },
  { path: '/merchant/products', icon: '📦', label: '商品管理' },
  { path: '/merchant/stock', icon: '🔑', label: '卡密管理' },
  { path: '/merchant/orders', icon: '🛒', label: '订单管理' },
  { path: '/merchant/api-keys', icon: '🔐', label: 'API Key' },
  { path: '/merchant/domain', icon: '🌐', label: '自定义域名' },
];
</script>

<template>
  <div class="merchant-layout" :style="{ '--theme-color': themeColor }">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">⚡</span>
        <div class="brand-text">
          <div class="brand-name">WM Card</div>
          <div class="brand-tag">商户工作台</div>
        </div>
      </div>

      <el-menu
        router
        :default-active="$route.path"
        class="side-menu"
        background-color="transparent"
        text-color="#94a3b8"
        active-text-color="#fff"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <span class="menu-icon">{{ item.icon }}</span>
          <span class="menu-label">{{ item.label }}</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <RouterLink to="/" class="back-home">← 返回首页</RouterLink>
      </div>
    </aside>

    <!-- 主区 -->
    <div class="main-wrapper">
      <!-- 顶部条 -->
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title-text">{{ getPageTitle($route.path) }}</h1>
        </div>
        <div class="topbar-right">
          <el-dropdown trigger="click" @command="(cmd: string) => (cmd === 'logout' ? onLogout() : onChangePassword())">
            <div class="user-chip">
              <div class="avatar">{{ (auth.user?.username?.[0] || '?').toUpperCase() }}</div>
              <div class="user-text">
                <div class="user-name">{{ auth.merchantName || auth.user?.username }}</div>
                <div class="user-role">商户</div>
              </div>
              <span class="user-caret">▾</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="change-password">
                  <span>🔑 修改密码</span>
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <span style="color: #f56c6c">退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';

const titles: Record<string, string> = {
  '/merchant/dashboard': '数据看板',
  '/merchant/products': '商品管理',
  '/merchant/stock': '卡密管理',
  '/merchant/orders': '订单管理',
  '/merchant/api-keys': 'API Key',
  '/merchant/domain': '自定义域名',
  '/merchant/settings': '账户设置',
  '/merchant/change-password': '修改密码',
};

export function getPageTitle(path: string): string {
  for (const k of Object.keys(titles).sort((a, b) => b.length - a.length)) {
    if (path === k || path.startsWith(k + '/')) return titles[k] ?? '';
  }
  return '商户工作台';
}
void ({} as RouteLocationNormalizedLoaded);
</script>

<style scoped>
.merchant-layout {
  min-height: 100vh;
  display: flex;
  background: #f1f5f9;
  color: #1e293b;
}

.sidebar {
  width: 220px;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.04);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--theme-color, #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.brand-text {
  line-height: 1.2;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.01em;
}

.brand-tag {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  letter-spacing: 0.05em;
}

.side-menu {
  flex: 1;
  border-right: none;
  padding: 12px 8px;
}

.side-menu :deep(.el-menu-item) {
  height: 42px;
  line-height: 42px;
  margin: 2px 0;
  border-radius: 6px;
  padding: 0 12px !important;
  font-size: 13px;
}

.side-menu :deep(.el-menu-item.is-active) {
  background: var(--theme-color, #6366f1) !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

.side-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.05) !important;
  color: #cbd5e1 !important;
}

.menu-icon {
  font-size: 16px;
  margin-right: 8px;
}

.menu-label {
  font-weight: 500;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.back-home {
  color: #64748b;
  text-decoration: none;
  font-size: 12px;
  transition: color 0.2s ease;
}

.back-home:hover {
  color: #cbd5e1;
}

/* 主区 */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 60px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.page-title-text {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.topbar-right {
  display: flex;
  align-items: center;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: #f1f5f9;
  border-radius: 24px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-chip:hover {
  background: #e2e8f0;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--theme-color, #6366f1);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-text {
  line-height: 1.2;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 11px;
  color: #64748b;
}

.user-caret {
  font-size: 10px;
  color: #94a3b8;
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: #f8fafc;
}
</style>
