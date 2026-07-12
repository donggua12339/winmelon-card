<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
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
interface TrendData {
  days: number;
  series: { date: string; orders: number; gmv: number }[];
}
interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}
interface StatusItem {
  status: string;
  count: number;
}

const stats = ref<Stat[]>([
  { label: '今日订单', value: '-', icon: '🛒', glow: 'glow-purple' },
  { label: '今日 GMV', value: '-', icon: '💰', glow: 'glow-cyan' },
  { label: '商品总数', value: '-', icon: '📦', glow: 'glow-pink' },
  { label: '订单总数', value: '-', icon: '📊', glow: 'glow-purple' },
]);

const loading = ref(false);
const trendDays = ref(7);
const topProducts = ref<TopProduct[]>([]);
const statusData = ref<StatusItem[]>([]);

const trendChart = ref<echarts.ECharts | null>(null);
const productChart = ref<echarts.ECharts | null>(null);
const statusChart = ref<echarts.ECharts | null>(null);
const trendEl = ref<HTMLDivElement | null>(null);
const productEl = ref<HTMLDivElement | null>(null);
const statusEl = ref<HTMLDivElement | null>(null);

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

async function fetchTrend(): Promise<void> {
  const data = await get<TrendData>('/admin/stats/trend', { params: { days: trendDays.value } });
  renderTrend(data.series);
}

async function fetchTopProducts(): Promise<void> {
  const data = await get<TopProduct[]>('/admin/stats/top-products', {
    params: { days: trendDays.value, limit: 10 },
  });
  topProducts.value = data;
  renderProducts(data);
}

async function fetchStatus(): Promise<void> {
  const data = await get<StatusItem[]>('/admin/stats/order-status', { params: { days: trendDays.value } });
  statusData.value = data;
  renderStatus(data);
}

function renderTrend(series: { date: string; orders: number; gmv: number }[]): void {
  if (!trendEl.value) return;
  if (!trendChart.value) {
    trendChart.value = echarts.init(trendEl.value);
  }
  trendChart.value.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单数', 'GMV'], textStyle: { color: '#cbd5e1' } },
    grid: { left: 40, right: 50, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: series.map((s) => s.date.slice(5)),
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    yAxis: [
      {
        type: 'value',
        name: '订单数',
        axisLabel: { color: '#94a3b8' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      },
      {
        type: 'value',
        name: 'GMV (¥)',
        axisLabel: { color: '#94a3b8' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: series.map((s) => s.orders),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#7c3aed' },
            { offset: 1, color: '#06b6d4' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'GMV',
        type: 'line',
        yAxisIndex: 1,
        data: series.map((s) => s.gmv),
        smooth: true,
        lineStyle: { color: '#f472b6', width: 3 },
        itemStyle: { color: '#f472b6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(244,114,182,0.3)' },
            { offset: 1, color: 'rgba(244,114,182,0)' },
          ]),
        },
      },
    ],
  });
}

function renderProducts(data: TopProduct[]): void {
  if (!productEl.value) return;
  if (!productChart.value) {
    productChart.value = echarts.init(productEl.value);
  }
  const reversed = [...data].reverse();
  productChart.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 120, right: 30, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    yAxis: {
      type: 'category',
      data: reversed.map((d) => d.name),
      axisLabel: { color: '#cbd5e1', fontSize: 12 },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    series: [
      {
        type: 'bar',
        data: reversed.map((d) => d.quantity),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: '#06b6d4' },
            { offset: 1, color: '#7c3aed' },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  });
}

function renderStatus(data: StatusItem[]): void {
  if (!statusEl.value) return;
  if (!statusChart.value) {
    statusChart.value = echarts.init(statusEl.value);
  }
  const colorMap: Record<string, string> = {
    PENDING: '#fbbf24',
    PAID: '#06b6d4',
    DELIVERED: '#34d399',
    EXPIRED: '#64748b',
    REFUNDED: '#f87171',
    CLOSED: '#475569',
  };
  const labelMap: Record<string, string> = {
    PENDING: '待支付',
    PAID: '已支付',
    DELIVERED: '已发卡',
    EXPIRED: '已超时',
    REFUNDED: '已退款',
    CLOSED: '已关闭',
  };
  statusChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: '#cbd5e1' },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#0f1424', borderWidth: 2 },
        label: { color: '#cbd5e1' },
        data: data.map((d) => ({
          name: labelMap[d.status] ?? d.status,
          value: d.count,
          itemStyle: { color: colorMap[d.status] ?? '#7c3aed' },
        })),
      },
    ],
  });
}

function resizeAll(): void {
  trendChart.value?.resize();
  productChart.value?.resize();
  statusChart.value?.resize();
}

watch(trendDays, () => {
  fetchTrend();
  fetchTopProducts();
  fetchStatus();
});

onMounted(async () => {
  await fetchStats();
  await nextTick();
  await Promise.all([fetchTrend(), fetchTopProducts(), fetchStatus()]);
  window.addEventListener('resize', resizeAll);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeAll);
  trendChart.value?.dispose();
  productChart.value?.dispose();
  statusChart.value?.dispose();
});
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

    <!-- 时间范围切换 -->
    <div class="range-bar">
      <span class="range-label">数据范围：</span>
      <el-radio-group v-model="trendDays" size="small">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="14">近 14 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 趋势图 -->
    <div class="glass chart-card">
      <h3 class="chart-title">订单 / GMV 趋势</h3>
      <div ref="trendEl" class="chart-box" style="height: 320px"></div>
    </div>

    <!-- 双列：销量排行 + 状态分布 -->
    <div class="dual-grid">
      <div class="glass chart-card">
        <h3 class="chart-title">商品销量 Top 10</h3>
        <div ref="productEl" class="chart-box" style="height: 360px"></div>
        <div v-if="topProducts.length === 0" class="empty-tip">暂无数据</div>
      </div>
      <div class="glass chart-card">
        <h3 class="chart-title">订单状态分布</h3>
        <div ref="statusEl" class="chart-box" style="height: 360px"></div>
        <div v-if="statusData.length === 0" class="empty-tip">暂无数据</div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="section">
      <h3 class="section-title">快捷操作</h3>
      <div class="actions-grid">
        <RouterLink to="/admin/products" class="glass action-card">
          <span class="action-icon">📦</span><span class="action-text">商品管理</span>
        </RouterLink>
        <RouterLink to="/admin/stock" class="glass action-card">
          <span class="action-icon">🔑</span><span class="action-text">导入卡密</span>
        </RouterLink>
        <RouterLink to="/admin/orders" class="glass action-card">
          <span class="action-icon">🛒</span><span class="action-text">订单管理</span>
        </RouterLink>
        <RouterLink to="/admin/audit-logs" class="glass action-card">
          <span class="action-icon">📋</span><span class="action-text">审计日志</span>
        </RouterLink>
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
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

.range-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.range-label {
  color: var(--wm-text-secondary);
  font-size: 13px;
}

.chart-card {
  padding: 20px;
  margin-bottom: 24px;
  position: relative;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 16px;
}

.chart-box {
  width: 100%;
}

.dual-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.empty-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

.section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 16px;
}

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
</style>
