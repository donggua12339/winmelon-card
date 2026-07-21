<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessageBox } from 'element-plus';
import NotificationBell from '@/components/NotificationBell.vue';
import { get } from '@/api/http';

const router = useRouter();
const auth = useAuthStore();
const themeColor = computed(() => auth.merchantThemeColor ?? '#6366f1');

interface Shop {
  id: string;
  code: string;
  name: string;
  isOnline: boolean;
}

const shopSwitcherOpen = ref(false);

async function loadShops(): Promise<void> {
  if (auth.shops.length > 0) return;
  try {
    const profile = await get<{
      name: string;
      themeColor?: string | null;
      shops: Shop[];
    }>('/merchant/profile');
    auth.setMerchantInfo({
      merchantName: profile.name,
      themeColor: profile.themeColor ?? undefined,
      shops: profile.shops.map((s) => ({ id: s.id, code: s.code, name: s.name, isOnline: s.isOnline })),
    });
  } catch {
    // 忽略，不阻塞页面
  }
}

function onShopChange(shopId: string): void {
  auth.setCurrentShop(shopId || null);
  shopSwitcherOpen.value = false;
}

const currentShopName = computed(() => {
  const s = auth.shops.find((x) => x.id === auth.currentShopId);
  return s?.name ?? '全部店铺';
});

async function onLogout(): Promise<void> {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' });
  await auth.logout();
  router.replace('/admin/login');
}

function onChangePassword(): void {
  router.push('/merchant/change-password');
}

onMounted(loadShops);

const menuItems = [
  { path: '/merchant/dashboard', icon: '📊', label: '数据看板' },
  { path: '/merchant/products', icon: '📦', label: '商品管理' },
  { path: '/merchant/stock', icon: '🔑', label: '卡密管理' },
  { path: '/merchant/orders', icon: '🛒', label: '订单管理' },
  { path: '/merchant/api-keys', icon: '🔐', label: 'API Key' },
  { path: '/merchant/domain', icon: '🌐', label: '自定义域名' },
  { path: '/merchant/withdrawals', icon: '💰', label: '提现结算' },
  { path: '/merchant/payment-channels', icon: '💳', label: '支付通道' },
  { path: '/merchant/invite', icon: '🎟️', label: '推广邀请' },
  { path: '/merchant/tickets', icon: '🎫', label: '工单处理' },
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

      <el-menu router :default-active="$route.path" class="side-menu">
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
          <!-- 店铺切换器 -->
          <el-dropdown v-if="auth.shops.length > 0" trigger="click" @command="onShopChange">
            <div class="shop-switcher">
              <span class="shop-icon">🏪</span>
              <span class="shop-name">{{ currentShopName }}</span>
              <span class="shop-caret">▾</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="'' as any">全部店铺</el-dropdown-item>
                <el-dropdown-item v-for="s in auth.shops" :key="s.id" :command="s.id">
                  {{ s.name }} <span style="color: var(--wm-text-tertiary); font-size: 12px">/{{ s.code }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="topbar-right">
          <NotificationBell />
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
  '/merchant/withdrawals': '提现结算',
  '/merchant/payment-channels': '支付通道',
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
  background: var(--wm-bg-deep);
  color: var(--wm-text-primary);
}

/* sidebar 跟随主题:亮色浅灰底,暗色深底 */
.sidebar {
  width: 220px;
  background: var(--wm-bg-elevated);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid var(--wm-border-default);
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
  background: var(--theme-color, var(--wm-accent-primary));
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
  --el-menu-bg-color: transparent;
  --el-menu-text-color: var(--wm-text-secondary);
  --el-menu-active-color: var(--wm-text-on-primary);
  --el-menu-hover-bg-color: var(--wm-bg-hover);
  --el-menu-hover-text-color: var(--wm-text-primary);
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
  background: var(--theme-color, var(--wm-accent-primary)) !important;
  color: var(--wm-text-on-primary) !important;
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
}

.back-home:hover {
  color: var(--wm-text-primary);
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
  background: var(--wm-bg-base);
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
  gap: var(--wm-space-md, 16px);
}

.page-title-text {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--wm-text-primary);
}

.shop-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--wm-radius-sm, 6px);
  border: 1px solid var(--wm-border-default, #e5e7eb);
  background: var(--wm-bg-card, #fff);
  cursor: pointer;
  font-size: 13px;
  color: var(--wm-text-primary);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.shop-switcher:hover {
  border-color: var(--wm-border-hover, #d1d5db);
  background: var(--wm-bg-hover, #f4f4f5);
}

.shop-icon {
  font-size: 14px;
}

.shop-name {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-caret {
  color: var(--wm-text-tertiary, #9ca3af);
  font-size: 11px;
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
  background: var(--wm-bg-hover);
  border-radius: 24px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.user-chip:hover {
  background: var(--wm-bg-active);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--theme-color, var(--wm-accent-primary));
  color: var(--wm-text-on-primary);
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
  max-width: 120px;
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
  background: var(--wm-bg-deep);
}
</style>
