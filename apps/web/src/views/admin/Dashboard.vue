<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { get } from '@/api/http';
import { useThemeStore } from '@/stores/theme';

const themeStore = useThemeStore();

interface Stat {
  label: string;
  value: string;
  icon: 'orders' | 'gmv' | 'products' | 'total';
  accent: 'primary' | 'success' | 'warning' | 'secondary';
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
  { label: '今日订单', value: '-', icon: 'orders', accent: 'primary' },
  { label: '今日 GMV', value: '-', icon: 'gmv', accent: 'success' },
  { label: '商品总数', value: '-', icon: 'products', accent: 'warning' },
  { label: '订单总数', value: '-', icon: 'total', accent: 'secondary' },
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

/** 从 CSS 变量读颜色，让 echarts 跟随主题 */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#635BFF';
}

/** 主题相关色集合 */
function chartColors() {
  return {
    text: cssVar('--wm-text-secondary'),
    textStrong: cssVar('--wm-text-primary'),
    textTertiary: cssVar('--wm-text-tertiary'),
    border: cssVar('--wm-border-default'),
    primary: cssVar('--wm-accent-primary'),
    secondary: cssVar('--wm-accent-secondary'),
    tertiary: cssVar('--wm-accent-tertiary'),
    success: cssVar('--wm-accent-success'),
    warning: cssVar('--wm-accent-warning'),
    danger: cssVar('--wm-accent-danger'),
    bgCard: cssVar('--wm-bg-card'),
  };
}

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
      { label: '今日订单', value: String(todayOrders.length), icon: 'orders', accent: 'primary' },
      { label: '今日 GMV', value: `¥${todayGmv.toFixed(2)}`, icon: 'gmv', accent: 'success' },
      { label: '商品总数', value: String(products.total), icon: 'products', accent: 'warning' },
      { label: '订单总数', value: String(orders.total), icon: 'total', accent: 'secondary' },
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
  const c = chartColors();
  trendChart.value.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.bgCard,
      borderColor: c.border,
      textStyle: { color: c.textStrong },
    },
    legend: { data: ['订单数', 'GMV'], textStyle: { color: c.text }, top: 0 },
    grid: { left: 40, right: 50, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: series.map((s) => s.date.slice(5)),
      axisLabel: { color: c.textTertiary },
      axisLine: { lineStyle: { color: c.border } },
    },
    yAxis: [
      {
        type: 'value',
        name: '订单数',
        nameTextStyle: { color: c.textTertiary },
        axisLabel: { color: c.textTertiary },
        splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
      },
      {
        type: 'value',
        name: 'GMV (¥)',
        nameTextStyle: { color: c.textTertiary },
        axisLabel: { color: c.textTertiary },
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
            { offset: 0, color: c.primary },
            { offset: 1, color: c.secondary },
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
        lineStyle: { color: c.tertiary, width: 3 },
        itemStyle: { color: c.tertiary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${c.tertiary}40` },
            { offset: 1, color: `${c.tertiary}00` },
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
  const c = chartColors();
  const reversed = [...data].reverse();
  productChart.value.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: c.bgCard,
      borderColor: c.border,
      textStyle: { color: c.textStrong },
    },
    grid: { left: 120, right: 30, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { color: c.textTertiary },
      splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: reversed.map((d) => d.name),
      axisLabel: { color: c.text, fontSize: 12 },
      axisLine: { lineStyle: { color: c.border } },
    },
    series: [
      {
        type: 'bar',
        data: reversed.map((d) => d.quantity),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
            { offset: 0, color: c.secondary },
            { offset: 1, color: c.primary },
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
  const c = chartColors();
  const colorMap: Record<string, string> = {
    PENDING: c.warning,
    PAID: c.secondary,
    DELIVERED: c.success,
    EXPIRED: c.textTertiary,
    REFUNDED: c.danger,
    CLOSED: c.textTertiary,
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
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: c.bgCard,
      borderColor: c.border,
      textStyle: { color: c.textStrong },
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: c.text },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: c.bgCard, borderWidth: 2 },
        label: { color: c.text },
        data: data.map((d) => ({
          name: labelMap[d.status] ?? d.status,
          value: d.count,
          itemStyle: { color: colorMap[d.status] ?? c.primary },
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

/** 主题切换时重新渲染所有图表（echarts 不会自动跟随 CSS 变量） */
function rerenderAll(): void {
  if (topProducts.value.length) renderProducts(topProducts.value);
  if (statusData.value.length) renderStatus(statusData.value);
  // 趋势图数据没存,简单 reload
  fetchTrend();
}

watch(trendDays, () => {
  fetchTrend();
  fetchTopProducts();
  fetchStatus();
});

watch(
  () => themeStore.theme.value,
  () => nextTick(rerenderAll),
);

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
    <header class="page-header">
      <div>
        <h2 class="page-title">数据看板</h2>
        <p class="page-desc">实时关注店铺运营状况</p>
      </div>
    </header>

    <!-- 数据卡片 -->
    <div class="stats-grid">
      <div v-for="(s, i) in stats" :key="i" class="stat-card" :class="`stat-${s.accent}`">
        <div class="stat-icon-wrap">
          <!-- orders -->
          <svg
            v-if="s.icon === 'orders'"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <!-- gmv -->
          <svg
            v-else-if="s.icon === 'gmv'"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <!-- products -->
          <svg
            v-else-if="s.icon === 'products'"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            ></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <!-- total -->
          <svg
            v-else
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}</div>
        </div>
      </div>
    </div>

    <!-- 时间范围切换 -->
    <div class="range-bar">
      <span class="range-label">数据范围</span>
      <el-radio-group v-model="trendDays" size="small">
        <el-radio-button :value="7">近 7 天</el-radio-button>
        <el-radio-button :value="14">近 14 天</el-radio-button>
        <el-radio-button :value="30">近 30 天</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 趋势图 -->
    <section class="panel">
      <h3 class="panel-title">订单 / GMV 趋势</h3>
      <div ref="trendEl" class="chart-box" style="height: 320px"></div>
    </section>

    <!-- 双列：销量排行 + 状态分布 -->
    <div class="dual-grid">
      <section class="panel">
        <h3 class="panel-title">商品销量 Top 10</h3>
        <div ref="productEl" class="chart-box" style="height: 360px"></div>
        <div v-if="topProducts.length === 0" class="empty-tip">暂无数据</div>
      </section>
      <section class="panel">
        <h3 class="panel-title">订单状态分布</h3>
        <div ref="statusEl" class="chart-box" style="height: 360px"></div>
        <div v-if="statusData.length === 0" class="empty-tip">暂无数据</div>
      </section>
    </div>

    <!-- 快捷操作 -->
    <section class="section">
      <h3 class="section-title">快捷操作</h3>
      <div class="actions-grid">
        <RouterLink to="/admin/products" class="action-card">
          <span class="action-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
              ></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </span>
          <span class="action-text">商品管理</span>
        </RouterLink>
        <RouterLink to="/admin/stock" class="action-card">
          <span class="action-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
              ></path>
            </svg>
          </span>
          <span class="action-text">导入卡密</span>
        </RouterLink>
        <RouterLink to="/admin/orders" class="action-card">
          <span class="action-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </span>
          <span class="action-text">订单管理</span>
        </RouterLink>
        <RouterLink to="/admin/audit-logs" class="action-card">
          <span class="action-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </span>
          <span class="action-text">审计日志</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: var(--wm-container-max);
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--wm-space-xl);
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--wm-text-primary);
  letter-spacing: -0.01em;
}

.page-desc {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--wm-space-md);
  margin-bottom: var(--wm-space-xl);
}

.stat-card {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-xl);
  display: flex;
  align-items: center;
  gap: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.stat-card:hover {
  box-shadow: var(--wm-shadow-md);
  border-color: var(--wm-border-hover);
  transform: translateY(-1px);
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--wm-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-primary .stat-icon-wrap {
  background: color-mix(in srgb, var(--wm-accent-primary) 12%, transparent);
  color: var(--wm-accent-primary);
}
.stat-success .stat-icon-wrap {
  background: color-mix(in srgb, var(--wm-accent-success) 12%, transparent);
  color: var(--wm-accent-success);
}
.stat-warning .stat-icon-wrap {
  background: color-mix(in srgb, var(--wm-accent-warning) 12%, transparent);
  color: var(--wm-accent-warning);
}
.stat-secondary .stat-icon-wrap {
  background: color-mix(in srgb, var(--wm-accent-secondary) 12%, transparent);
  color: var(--wm-accent-secondary);
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  line-height: 1;
  color: var(--wm-text-primary);
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.range-bar {
  display: flex;
  align-items: center;
  gap: var(--wm-space-md);
  margin-bottom: var(--wm-space-md);
}

.range-label {
  color: var(--wm-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-xl);
  margin-bottom: var(--wm-space-xl);
  position: relative;
  box-shadow: var(--wm-shadow-sm);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 var(--wm-space-md);
  letter-spacing: -0.005em;
}

.chart-box {
  width: 100%;
}

.dual-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--wm-space-md);
  margin-bottom: var(--wm-space-xl);
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
  margin-bottom: var(--wm-space-2xl);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 var(--wm-space-md);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--wm-space-md);
}

.action-card {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-md);
  padding: var(--wm-space-lg);
  display: flex;
  align-items: center;
  gap: var(--wm-space-md);
  text-decoration: none;
  color: var(--wm-text-primary);
  transition: all 0.15s ease;
}

.action-card:hover {
  background: var(--wm-bg-hover);
  border-color: var(--wm-border-hover);
  transform: translateY(-1px);
}

.action-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--wm-radius-sm);
  background: color-mix(in srgb, var(--wm-accent-primary) 10%, transparent);
  color: var(--wm-accent-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-text {
  font-size: 14px;
  font-weight: 500;
}
</style>
