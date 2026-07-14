<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { get } from '@/api/http';
import { useRouter } from 'vue-router';

interface DashboardStats {
  today: { orders: number; paidOrders: number; revenue: number; uv: number; conversionRate: number };
  yesterday: { uv: number };
  month: { paidOrders: number; revenue: number; grossRevenue: number };
  pendingOrders: number;
  totalOrders: number;
  repurchaseRate: number;
  topProducts: { productId: string; productName: string; sold: number; revenue: number }[];
  trend7d: { date: string; orders: number; revenue: number }[];
  uvTrend7d: { date: string; uv: number; pv: number }[];
}

const router = useRouter();
const stats = ref<DashboardStats | null>(null);
const loading = ref(false);

// 处理 7 天 UV 趋势数据（用于双轴展示）
const trendMaxOrders = computed(() => {
  if (!stats.value?.trend7d.length) return 0;
  return Math.max(...stats.value.trend7d.map((d) => d.orders), 1);
});

const trendMaxUv = computed(() => {
  if (!stats.value?.uvTrend7d?.length) return 0;
  return Math.max(...stats.value.uvTrend7d.map((d) => d.uv), 1);
});

const trendBars = computed(() => {
  const orderData = stats.value?.trend7d ?? [];
  const uvData = stats.value?.uvTrend7d ?? [];
  // 合并订单和 UV 数据到同一日期轴
  return orderData.map((d) => {
    const uv = uvData.find((u) => u.date === d.date)?.uv ?? 0;
    return {
      ...d,
      uv,
      heightPct: Math.max(8, Math.round((d.orders / trendMaxOrders.value) * 100)),
      uvHeightPct: Math.max(8, Math.round((uv / Math.max(trendMaxUv.value, 1)) * 100)),
    };
  });
});

// UV 环比变化
const uvDelta = computed(() => {
  const today = stats.value?.today.uv ?? 0;
  const yesterday = stats.value?.yesterday.uv ?? 0;
  if (yesterday === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
});

function formatMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

async function fetchStats(): Promise<void> {
  loading.value = true;
  try {
    stats.value = await get<DashboardStats>('/merchant/dashboard/stats');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchStats);
</script>

<template>
  <div v-loading="loading" class="merchant-dashboard">
    <!-- 欢迎条 -->
    <div class="welcome-card">
      <div>
        <h2 class="welcome-title">欢迎回来</h2>
        <p class="welcome-tip">
          今日共 {{ stats?.today.orders ?? 0 }} 笔订单，已支付 {{ stats?.today.paidOrders ?? 0 }} 笔，收入 ¥{{
            (stats?.today.revenue ?? 0).toFixed(2)
          }}
        </p>
      </div>
      <div class="welcome-actions">
        <el-button type="primary" plain size="small" @click="router.push('/merchant/products')">
          📦 上架商品
        </el-button>
        <el-button type="primary" plain size="small" @click="router.push('/merchant/stock')"> 🔑 导入卡密 </el-button>
      </div>
    </div>

    <!-- 核心指标 -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-blue">
        <div class="kpi-label">今日订单</div>
        <div class="kpi-value">{{ stats?.today.orders ?? 0 }}</div>
        <div class="kpi-sub"><span class="kpi-dot blue"></span>已支付 {{ stats?.today.paidOrders ?? 0 }}</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-label">今日收入</div>
        <div class="kpi-value">{{ formatMoney(stats?.today.revenue ?? 0) }}</div>
        <div class="kpi-sub"><span class="kpi-dot green"></span>实时统计</div>
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-label">今日 UV</div>
        <div class="kpi-value">{{ stats?.today.uv ?? 0 }}</div>
        <div class="kpi-sub">
          <span class="kpi-dot purple"></span>转化率 {{ stats?.today.conversionRate ?? 0 }}% · 环比
          <span :style="{ color: uvDelta >= 0 ? '#10b981' : '#ef4444' }">
            {{ uvDelta >= 0 ? '+' : '' }}{{ uvDelta }}%
          </span>
        </div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-label">待处理订单</div>
        <div class="kpi-value">{{ stats?.pendingOrders ?? 0 }}</div>
        <div class="kpi-sub"><span class="kpi-dot orange"></span>需关注</div>
      </div>
    </div>

    <!-- 本月汇总 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="section-header">
          <span class="section-title">📊 本月汇总</span>
          <el-tag size="small" type="info">{{
            new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
          }}</el-tag>
        </div>
      </template>
      <div class="month-summary">
        <div class="summary-item">
          <div class="summary-label">订单数</div>
          <div class="summary-value">{{ stats?.month.paidOrders ?? 0 }}</div>
          <div class="summary-trend">已支付</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">销售额</div>
          <div class="summary-value">{{ formatMoney(stats?.month.revenue ?? 0) }}</div>
          <div class="summary-trend">本月成交</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">总交易额</div>
          <div class="summary-value">{{ formatMoney(stats?.month.grossRevenue ?? 0) }}</div>
          <div class="summary-trend">含退款等</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <div class="summary-label">复购率</div>
          <div class="summary-value">{{ stats?.repurchaseRate ?? 0 }}%</div>
          <div class="summary-trend">本月买家</div>
        </div>
      </div>
    </el-card>

    <!-- 7 天趋势 + Top 5 -->
    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card class="section-card" shadow="never">
          <template #header>
            <div class="section-header">
              <span class="section-title">📈 最近 7 天订单 / UV 趋势</span>
              <div class="trend-legend">
                <span class="legend-item"><span class="legend-dot orders"></span>订单</span>
                <span class="legend-item"><span class="legend-dot uv"></span>UV</span>
              </div>
            </div>
          </template>
          <div v-if="trendBars.length" class="trend-chart">
            <div v-for="d in trendBars" :key="d.date" class="trend-bar-wrap">
              <div class="trend-bar-stack">
                <div class="trend-bar uv-bar" :style="{ height: d.uvHeightPct + '%' }">
                  <span class="trend-value uv-value">{{ d.uv }}</span>
                </div>
                <div class="trend-bar" :style="{ height: d.heightPct + '%' }">
                  <span class="trend-value">{{ d.orders }}</span>
                </div>
              </div>
              <div class="trend-date">
                {{ new Date(d.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) }}
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无趋势数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card class="section-card" shadow="never">
          <template #header>
            <div class="section-header">
              <span class="section-title">🏆 本月销量 Top 5</span>
            </div>
          </template>
          <div v-if="stats?.topProducts.length" class="top-list">
            <div v-for="(p, idx) in stats.topProducts" :key="p.productId" class="top-item">
              <span :class="['top-rank', `rank-${idx + 1}`]">{{ idx + 1 }}</span>
              <span class="top-name">{{ p.productName }}</span>
              <span class="top-sold">×{{ p.sold }}</span>
              <span class="top-revenue">{{ formatMoney(p.revenue) }}</span>
            </div>
          </div>
          <el-empty v-else description="本月暂无销售数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.merchant-dashboard {
  max-width: 1280px;
  margin: 0 auto;
}

/* 欢迎条 */
.welcome-card {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
}

.welcome-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
}

.welcome-tip {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

.welcome-actions {
  display: flex;
  gap: 8px;
}

.welcome-actions :deep(.el-button) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
  backdrop-filter: blur(10px);
}

.welcome-actions :deep(.el-button:hover) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

/* KPI 网格 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid #e2e8f0;
  position: relative;
  overflow: hidden;
}

.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--kpi-color);
}

.kpi-blue {
  --kpi-color: #3b82f6;
}
.kpi-green {
  --kpi-color: #10b981;
}
.kpi-orange {
  --kpi-color: #f59e0b;
}
.kpi-purple {
  --kpi-color: #8b5cf6;
}

.kpi-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
  font-weight: 500;
}

.kpi-value {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  letter-spacing: -0.02em;
}

.kpi-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.kpi-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.kpi-dot.blue {
  background: #3b82f6;
}
.kpi-dot.green {
  background: #10b981;
}
.kpi-dot.orange {
  background: #f59e0b;
}
.kpi-dot.purple {
  background: #8b5cf6;
}

/* 卡片 */
.section-card {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.section-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid #f1f5f9;
}

.section-card :deep(.el-card__body) {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

/* 本月汇总 */
.month-summary {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.summary-item {
  text-align: center;
  flex: 1;
  padding: 8px;
}

.summary-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  font-family: 'SF Mono', Monaco, monospace;
  letter-spacing: -0.01em;
}

.summary-trend {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.summary-divider {
  width: 1px;
  height: 40px;
  background: #e2e8f0;
}

/* 7 天趋势柱状图 */
.trend-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 180px;
  padding: 16px 8px 0;
  gap: 4px;
}

.trend-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.trend-bar-stack {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 100%;
  justify-content: center;
  height: 100%;
}

.trend-bar {
  width: 18px;
  max-width: 24px;
  background: linear-gradient(180deg, #818cf8 0%, #6366f1 100%);
  border-radius: 6px 6px 0 0;
  position: relative;
  min-height: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  transition: height 0.5s ease;
}

.uv-bar {
  background: linear-gradient(180deg, #c084fc 0%, #a855f7 100%);
}

.trend-value {
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}

.uv-value {
  font-size: 10px;
}

.trend-date {
  font-size: 11px;
  color: #64748b;
  margin-top: 6px;
}

.trend-legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}

.legend-dot.orders {
  background: linear-gradient(180deg, #818cf8 0%, #6366f1 100%);
}

.legend-dot.uv {
  background: linear-gradient(180deg, #c084fc 0%, #a855f7 100%);
}

/* Top 5 列表 */
.top-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.top-item:hover {
  background: #f8fafc;
}

.top-rank {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.top-rank.rank-1 {
  background: #fef3c7;
  color: #d97706;
}
.top-rank.rank-2 {
  background: #f1f5f9;
  color: #475569;
}
.top-rank.rank-3 {
  background: #fed7aa;
  color: #c2410c;
}

.top-name {
  flex: 1;
  font-size: 14px;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-sold {
  font-size: 12px;
  color: #94a3b8;
  font-family: monospace;
}

.top-revenue {
  font-size: 14px;
  font-weight: 700;
  color: #6366f1;
  font-family: monospace;
  min-width: 80px;
  text-align: right;
}
</style>
