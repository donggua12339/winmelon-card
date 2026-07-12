<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { get } from '@/api/http';

interface Stat {
  label: string;
  value: string;
  icon: string;
  glow: string;
}
interface ProductList {
  items: unknown[];
  total: number;
}
interface OrderList {
  items: Array<{ totalAmount: string; status: string; createdAt: string }>;
  total: number;
}

const stats = ref<Stat[]>([
  { label: '今日订单', value: '-', icon: '🛒', glow: 'glow-purple' },
  { label: '今日 GMV', value: '-', icon: '💰', glow: 'glow-cyan' },
  { label: '商品总数', value: '-', icon: '📦', glow: 'glow-pink' },
  { label: '订单总数', value: '-', icon: '📊', glow: 'glow-purple' },
]);

const loading = ref(false);

async function fetchStats(): Promise<void> {
  loading.value = true;
  try {
    const [products, orders] = await Promise.all([
      get<ProductList>('/admin/products', { params: { pageSize: 1 } }),
      get<OrderList>('/admin/orders', { params: { pageSize: 100 } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = orders.items.filter((o) => new Date(o.createdAt) >= today);
    const todayGmv = todayOrders
      .filter((o) => o.status === 'PAID' || o.status === 'DELIVERED')
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    stats.value = [
      { label: '今日订单', value: String(todayOrders.length), icon: '🛒', glow: 'glow-purple' },
      { label: '今日 GMV', value: `¥${todayGmv.toFixed(2)}`, icon: '💰', glow: 'glow-cyan' },
      { label: '商品总数', value: String(products.total), icon: '📦', glow: 'glow-pink' },
      { label: '订单总数', value: String(orders.total), icon: '📊', glow: 'glow-purple' },
    ];
  } finally {
    loading.value = false;
  }
}

onMounted(fetchStats);
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <div class="page-header">
      <h2>数据看板</h2>
      <p class="page-desc">实时关注店铺运营状况</p>
    </div>

    <!-- 数据卡片 -->
    <div class="stats-grid">
      <div v-for="(s, i) in stats" :key="i" class="glass stat-card" :class="s.glow">
        <div class="stat-icon">{{ s.icon }}</div>
        <div class="stat-info">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value num-highlight">{{ s.value }}</div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="section">
      <h3 class="section-title">快捷操作</h3>
      <div class="actions-grid">
        <RouterLink to="/admin/products" class="glass action-card">
          <span class="action-icon">📦</span>
          <span class="action-text">商品管理</span>
        </RouterLink>
        <RouterLink to="/admin/stock" class="glass action-card">
          <span class="action-icon">🔑</span>
          <span class="action-text">导入卡密</span>
        </RouterLink>
        <RouterLink to="/admin/orders" class="glass action-card">
          <span class="action-icon">🛒</span>
          <span class="action-text">订单管理</span>
        </RouterLink>
        <RouterLink to="/admin/payments" class="glass action-card">
          <span class="action-icon">💳</span>
          <span class="action-text">支付配置</span>
        </RouterLink>
      </div>
    </div>

    <!-- 系统状态 -->
    <div class="section">
      <h3 class="section-title">系统状态</h3>
      <div class="glass status-card">
        <div class="status-row">
          <span class="status-name">API 服务</span>
          <span class="status-badge online">
            <span class="status-dot online"></span>
            运行中
          </span>
        </div>
        <div class="status-row">
          <span class="status-name">数据库</span>
          <span class="status-badge online">
            <span class="status-dot online"></span>
            已连接
          </span>
        </div>
        <div class="status-row">
          <span class="status-name">Redis 缓存</span>
          <span class="status-badge online">
            <span class="status-dot online"></span>
            已连接
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
}

.page-desc {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

/* 数据卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.4s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--wm-radius-md);
  background: var(--wm-glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  line-height: 1;
}

/* 区块 */
.section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 16px;
}

/* 快捷操作 */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.action-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--wm-text-primary);
  transition: all 0.3s ease;
}

.action-card:hover {
  transform: translateY(-2px);
  border-color: var(--wm-border-glass-hover);
}

.action-icon {
  font-size: 24px;
}

.action-text {
  font-size: 14px;
  font-weight: 500;
}

/* 状态 */
.status-card {
  padding: 8px 0;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  border-bottom: 1px solid var(--wm-border-glass);
}

.status-row:last-child {
  border-bottom: none;
}

.status-name {
  font-size: 14px;
  color: var(--wm-text-secondary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
}

.status-badge.online {
  color: var(--wm-accent-green);
}
</style>
