<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';
import NotificationBell from '@/components/NotificationBell.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  await auth.logout();
  router.replace('/admin/login');
}

function onChangePassword(): void {
  router.push('/admin/change-password');
}

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    '/admin/dashboard': '数据看板',
    '/admin/products': '商品管理',
    '/admin/stock': '卡密管理',
    '/admin/orders': '订单管理',
    '/admin/payments': '支付配置',
    '/admin/system': '系统配置',
    '/admin/audit-logs': '审计日志',
    '/admin/webhook': 'Webhook 监控',
    '/admin/platform-config': '平台配置',
    '/admin/stats': '高级统计',
    '/admin/risk': '行为风控',
    '/admin/merchant-applications': '商户审核',
    '/admin/api-keys': 'API Key',
    '/admin/domain': '自定义域名',
    '/admin/withdrawals': '提现审核',
    '/admin/change-password': '修改密码',
    '/admin/refunds': '退款管理',
    '/admin/finance': '财务对账',
  };
  for (const k of Object.keys(titles).sort((a, b) => b.length - a.length)) {
    if (path === k || path.startsWith(k + '/')) return titles[k] ?? '';
  }
  return '管理后台';
}

const pageTitle = computed(() => getPageTitle(route.path));

const menuItems = [
  { path: '/admin/dashboard', icon: '📊', label: '数据看板' },
  { path: '/admin/products', icon: '📦', label: '商品管理' },
  { path: '/admin/stock', icon: '🔑', label: '卡密管理' },
  { path: '/admin/orders', icon: '🛒', label: '订单管理' },
  { path: '/admin/payments', icon: '💳', label: '支付配置' },
  { path: '/admin/merchant-applications', icon: '🏪', label: '商户审核' },
  { path: '/admin/api-keys', icon: '🔐', label: 'API Key' },
  { path: '/admin/domain', icon: '🌐', label: '自定义域名' },
  { path: '/admin/withdrawals', icon: '💰', label: '提现审核' },
  { path: '/admin/refunds', icon: '↩️', label: '退款管理' },
  { path: '/admin/finance/daily-report', icon: '📊', label: '财务对账' },
  { path: '/admin/finance/alerts', icon: '🚨', label: '对账告警' },
  { path: '/admin/articles', icon: '📰', label: '文章公告' },
  { path: '/admin/tickets', icon: '🎫', label: '工单处理' },
  { path: '/admin/risk', icon: '🛡️', label: '行为风控' },
  { path: '/admin/stats', icon: '📈', label: '高级统计' },
  { path: '/admin/audit-logs', icon: '📋', label: '审计日志' },
  { path: '/admin/webhook', icon: '🔔', label: 'Webhook 监控' },
  { path: '/admin/platform-config', icon: '⚙️', label: '平台配置' },
  { path: '/admin/system', icon: '⚙️', label: '系统配置' },
];
</script>

<template>
  <div class="admin-layout">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-icon">⚡</span>
        <div class="brand-text">
          <div class="brand-name">WM Card</div>
          <div class="brand-tag">平台管理后台</div>
        </div>
      </div>

      <el-menu router :default-active="$route.path" class="side-menu" background-color="transparent">
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
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title-text">{{ pageTitle }}</h1>
        </div>
        <div class="topbar-right">
          <ThemeToggle />
          <NotificationBell />
          <el-dropdown trigger="click" @command="(cmd: string) => (cmd === 'logout' ? onLogout() : onChangePassword())">
            <div class="user-chip">
              <div class="avatar">{{ (auth.user?.username?.[0] || '?').toUpperCase() }}</div>
              <div class="user-text">
                <div class="user-name">{{ auth.user?.username }}</div>
                <div class="user-role">平台管理员</div>
              </div>
              <span class="user-caret">▾</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="change-password">
                  <span>🔑 修改密码</span>
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <span style="color: var(--wm-accent-danger)">退出登录</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.admin-layout {
  min-height: 100vh;
  display: flex;
  background: var(--wm-bg-base);
  color: var(--wm-text-primary);
}

.sidebar {
  width: 220px;
  background: var(--wm-bg-elevated);
  border-right: 1px solid var(--wm-border-default);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 24px;
  border-bottom: 1px solid var(--wm-border-default);
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--wm-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.brand-text {
  line-height: 1.2;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--wm-text-primary);
  letter-spacing: -0.01em;
}

.brand-tag {
  font-size: 11px;
  color: var(--wm-text-tertiary);
  margin-top: 2px;
  letter-spacing: 0.05em;
}

.side-menu {
  flex: 1;
  border-right: none;
  padding: 12px 8px;
  overflow-y: auto;
}

.side-menu :deep(.el-menu-item) {
  height: 42px;
  line-height: 42px;
  margin: 2px 0;
  border-radius: 6px;
  padding: 0 12px !important;
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.side-menu :deep(.el-menu-item.is-active) {
  background: var(--wm-gradient-primary) !important;
  color: var(--wm-text-on-primary) !important;
  box-shadow: var(--wm-shadow-primary);
}

.side-menu :deep(.el-menu-item:hover) {
  background: var(--wm-bg-hover) !important;
  color: var(--wm-text-primary) !important;
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
  border-top: 1px solid var(--wm-border-default);
}

.back-home {
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 12px;
  transition: color 0.2s ease;

  &:hover {
    color: var(--wm-text-secondary);
  }
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
  background: var(--wm-bg-elevated);
  border-bottom: 1px solid var(--wm-border-default);
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
  color: var(--wm-text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  background: var(--wm-glass-bg);
  border: 1px solid var(--wm-border-default);
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--wm-glass-bg-hover);
    border-color: var(--wm-border-hover);
  }
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--wm-gradient-primary);
  color: white;
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
  color: var(--wm-text-primary);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 11px;
  color: var(--wm-text-tertiary);
}

.user-caret {
  font-size: 10px;
  color: var(--wm-text-tertiary);
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--wm-bg-base);
}
</style>
