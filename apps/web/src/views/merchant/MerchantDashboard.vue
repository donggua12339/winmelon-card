<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { get } from '@/api/http';
import { useRouter } from 'vue-router';

interface FunnelStep {
  uv: number;
  orderUv: number;
  paidUv: number;
  visitToOrderRate: number;
  orderToPayRate: number;
  overallRate: number;
}

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
  conversionFunnel: {
    total: FunnelStep;
    byNewReturning: { new: FunnelStep; returning: FunnelStep };
    byProduct: Array<{
      productId: string;
      productName: string;
      sold: number;
      funnel: FunnelStep;
    }>;
    daily: Array<FunnelStep & { date: string }>;
  };
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

function formatShortDate(s: string): string {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
          <span :style="{ color: uvDelta >= 0 ? 'var(--wm-accent-success)' : 'var(--wm-accent-danger)' }">
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

    <!-- P0-3 v2 转化漏斗 -->
    <el-card v-if="stats?.conversionFunnel" class="section-card funnel-card" shadow="never">
      <template #header>
        <div class="section-header">
          <span class="section-title">🎯 近 7 天转化漏斗</span>
          <div class="funnel-tags">
            <el-tag size="small" type="info">24h 归因</el-tag>
            <el-tag size="small" type="success">PAID+DELIVERED</el-tag>
            <el-tag size="small" type="warning">已过滤爬虫</el-tag>
          </div>
        </div>
      </template>

      <!-- 总漏斗 -->
      <div class="funnel-block">
        <div class="block-label">总漏斗</div>
        <div class="funnel-wrap">
          <div class="funnel-step uv-step">
            <div class="step-label">访客 UV</div>
            <div class="step-value">{{ stats.conversionFunnel.total.uv }}</div>
          </div>
          <div class="funnel-arrow">
            <span class="arrow-line"></span>
            <span class="arrow-rate">{{ stats.conversionFunnel.total.visitToOrderRate }}%</span>
            <span class="arrow-caption">访问 → 下单</span>
          </div>
          <div class="funnel-step order-step">
            <div class="step-label">下单 UV</div>
            <div class="step-value">{{ stats.conversionFunnel.total.orderUv }}</div>
          </div>
          <div class="funnel-arrow">
            <span class="arrow-line"></span>
            <span class="arrow-rate">{{ stats.conversionFunnel.total.orderToPayRate }}%</span>
            <span class="arrow-caption">下单 → 支付</span>
          </div>
          <div class="funnel-step paid-step">
            <div class="step-label">支付 UV</div>
            <div class="step-value">{{ stats.conversionFunnel.total.paidUv }}</div>
          </div>
        </div>
        <div class="funnel-overall">
          整体转化率：
          <span class="overall-rate">{{ stats.conversionFunnel.total.overallRate }}%</span>
          （支付 UV / 总 UV）
        </div>
      </div>

      <!-- 新/回访拆分 -->
      <div class="funnel-block">
        <div class="block-label">新访客 vs 回访访客</div>
        <div class="split-wrap">
          <div class="split-section">
            <div class="split-title">🆕 新访客 <span class="split-sub">（首次访问该店铺）</span></div>
            <div class="funnel-wrap small">
              <div class="funnel-step uv-step">
                <div class="step-label">UV</div>
                <div class="step-value-sm">{{ stats.conversionFunnel.byNewReturning.new.uv }}</div>
              </div>
              <div class="funnel-arrow">
                <span class="arrow-line"></span>
                <span class="arrow-rate">{{ stats.conversionFunnel.byNewReturning.new.visitToOrderRate }}%</span>
              </div>
              <div class="funnel-step order-step">
                <div class="step-label">下单</div>
                <div class="step-value-sm">{{ stats.conversionFunnel.byNewReturning.new.orderUv }}</div>
              </div>
              <div class="funnel-arrow">
                <span class="arrow-line"></span>
                <span class="arrow-rate">{{ stats.conversionFunnel.byNewReturning.new.orderToPayRate }}%</span>
              </div>
              <div class="funnel-step paid-step">
                <div class="step-label">支付</div>
                <div class="step-value-sm">{{ stats.conversionFunnel.byNewReturning.new.paidUv }}</div>
              </div>
            </div>
            <div class="funnel-overall-sm">
              转化率 <span class="overall-rate-sm">{{ stats.conversionFunnel.byNewReturning.new.overallRate }}%</span>
            </div>
          </div>
          <div class="split-divider"></div>
          <div class="split-section">
            <div class="split-title">🔁 回访访客 <span class="split-sub">（历史曾访问）</span></div>
            <div class="funnel-wrap small">
              <div class="funnel-step uv-step">
                <div class="step-label">UV</div>
                <div class="step-value-sm">{{ stats.conversionFunnel.byNewReturning.returning.uv }}</div>
              </div>
              <div class="funnel-arrow">
                <span class="arrow-line"></span>
                <span class="arrow-rate">{{ stats.conversionFunnel.byNewReturning.returning.visitToOrderRate }}%</span>
              </div>
              <div class="funnel-step order-step">
                <div class="step-label">下单</div>
                <div class="step-value-sm">{{ stats.conversionFunnel.byNewReturning.returning.orderUv }}</div>
              </div>
              <div class="funnel-arrow">
                <span class="arrow-line"></span>
                <span class="arrow-rate">{{ stats.conversionFunnel.byNewReturning.returning.orderToPayRate }}%</span>
              </div>
              <div class="funnel-step paid-step">
                <div class="step-label">支付</div>
                <div class="step-value-sm">{{ stats.conversionFunnel.byNewReturning.returning.paidUv }}</div>
              </div>
            </div>
            <div class="funnel-overall-sm">
              转化率
              <span class="overall-rate-sm">{{ stats.conversionFunnel.byNewReturning.returning.overallRate }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top 3 产品漏斗 -->
      <div v-if="stats.conversionFunnel.byProduct.length" class="funnel-block">
        <div class="block-label">Top 3 产品漏斗</div>
        <div class="product-grid">
          <div v-for="p in stats.conversionFunnel.byProduct" :key="p.productId" class="product-card">
            <div class="product-name" :title="p.productName">{{ p.productName }}</div>
            <div class="product-stats">
              <span>售出 {{ p.sold }}</span>
              <span
                >转化率 <b :class="{ highlight: p.funnel.overallRate > 0 }">{{ p.funnel.overallRate }}%</b></span
              >
            </div>
            <div class="product-funnel">
              <div class="pf-item uv">{{ p.funnel.orderUv }} 单 / {{ p.funnel.uv }} UV</div>
              <div class="pf-bar">
                <div class="pf-fill" :style="{ width: Math.min(100, p.funnel.overallRate * 5) + '%' }"></div>
              </div>
              <div class="pf-paid">已支付 {{ p.funnel.paidUv }} UV</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 7 日 mini funnel -->
      <div v-if="stats.conversionFunnel.daily.length" class="funnel-block">
        <div class="block-label">每日独立漏斗</div>
        <div class="daily-grid">
          <div v-for="d in stats.conversionFunnel.daily" :key="d.date" class="daily-funnel">
            <div class="daily-date">{{ formatShortDate(d.date) }}</div>
            <div class="daily-numbers">
              <div class="dn uv">
                <span class="dn-num">{{ d.uv }}</span
                ><span class="dn-lbl">UV</span>
              </div>
              <div class="dn-arr">→</div>
              <div class="dn ord">
                <span class="dn-num">{{ d.orderUv }}</span
                ><span class="dn-lbl">单</span>
              </div>
              <div class="dn-arr">→</div>
              <div class="dn paid">
                <span class="dn-num">{{ d.paidUv }}</span
                ><span class="dn-lbl">付</span>
              </div>
            </div>
            <div class="daily-rate">{{ d.overallRate }}%</div>
          </div>
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
  background: linear-gradient(135deg, var(--wm-accent-primary) 0%, var(--wm-accent-tertiary) 100%);
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
  background: var(--wm-bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--wm-border-default);
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
  --kpi-color: var(--wm-accent-secondary);
}
.kpi-green {
  --kpi-color: var(--wm-accent-success);
}
.kpi-orange {
  --kpi-color: var(--wm-accent-warning);
}
.kpi-purple {
  --kpi-color: var(--wm-accent-tertiary);
}

.kpi-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.kpi-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--wm-text-primary);
  line-height: 1.2;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  letter-spacing: -0.02em;
}

.kpi-sub {
  font-size: 12px;
  color: var(--wm-text-tertiary);
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
  background: var(--wm-accent-secondary);
}
.kpi-dot.green {
  background: var(--wm-accent-success);
}
.kpi-dot.orange {
  background: var(--wm-accent-warning);
}
.kpi-dot.purple {
  background: var(--wm-accent-tertiary);
}

/* 卡片 */
.section-card {
  border-radius: 12px;
  border: 1px solid var(--wm-border-default);
}

.section-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid var(--wm-border-default);
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
  color: var(--wm-text-primary);
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
  color: var(--wm-text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--wm-text-primary);
  font-family: 'SF Mono', Monaco, monospace;
  letter-spacing: -0.01em;
}

.summary-trend {
  font-size: 11px;
  color: var(--wm-text-tertiary);
  margin-top: 4px;
}

.summary-divider {
  width: 1px;
  height: 40px;
  background: var(--wm-border-default);
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
  background: var(--wm-accent-primary);
  border-radius: 6px 6px 0 0;
  position: relative;
  min-height: 24px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  transition: height 0.5s ease;
  opacity: 0.8;
}

.uv-bar {
  background: var(--wm-accent-secondary);
  opacity: 0.6;
}

.trend-value {
  font-size: 10px;
  font-weight: 700;
  color: var(--wm-text-on-primary);
}

.uv-value {
  font-size: 10px;
}

.trend-date {
  font-size: 11px;
  color: var(--wm-text-secondary);
  margin-top: 6px;
}

.trend-legend {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--wm-text-secondary);
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
  background: var(--wm-accent-primary);
}

.legend-dot.uv {
  background: var(--wm-accent-secondary);
  opacity: 0.7;
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
  background: var(--wm-bg-hover);
}

.top-rank {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--wm-bg-hover);
  color: var(--wm-text-secondary);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.top-rank.rank-1 {
  background: rgba(245, 158, 11, 0.15);
  color: var(--wm-accent-warning);
}
.top-rank.rank-2 {
  background: var(--wm-bg-hover);
  color: var(--wm-text-secondary);
}
.top-rank.rank-3 {
  background: rgba(234, 88, 12, 0.12);
  color: var(--wm-accent-danger);
}

.top-name {
  flex: 1;
  font-size: 14px;
  color: var(--wm-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-sold {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  font-family: monospace;
}

.top-revenue {
  font-size: 14px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  font-family: monospace;
  min-width: 80px;
  text-align: right;
}

/* 转化漏斗 */
.funnel-card {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
}

[data-theme='aurora-dark'] .funnel-card {
  background: var(--wm-bg-elevated);
}

.funnel-wrap {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
}

.funnel-step {
  flex: 1;
  background: var(--wm-bg-card);
  border-radius: 10px;
  padding: 18px 12px;
  text-align: center;
  border: 1px solid var(--wm-border-default);
  position: relative;
}

.funnel-step.uv-step {
  border-color: var(--wm-accent-primary);
  background: var(--wm-bg-card);
}

.funnel-step.order-step {
  border-color: var(--wm-accent-warning);
  background: var(--wm-bg-card);
}

.funnel-step.paid-step {
  border-color: var(--wm-accent-success);
  background: var(--wm-bg-card);
}

[data-theme='aurora-dark'] .funnel-step.uv-step {
  background: rgba(99, 91, 255, 0.08);
}

[data-theme='aurora-dark'] .funnel-step.order-step {
  background: rgba(245, 158, 11, 0.08);
}

[data-theme='aurora-dark'] .funnel-step.paid-step {
  background: rgba(22, 163, 74, 0.08);
}

.step-label {
  font-size: 12px;
  color: var(--wm-text-secondary);
  margin-bottom: 6px;
}

.step-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--wm-text-primary);
  font-family: 'SF Mono', Monaco, monospace;
  letter-spacing: -0.02em;
}

.funnel-arrow {
  flex: 0 0 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  padding: 0 8px;
}

.arrow-line {
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--wm-border-hover) 50%, transparent 100%);
  position: relative;
}

.arrow-line::after {
  content: '▶';
  position: absolute;
  right: -4px;
  top: -9px;
  color: var(--wm-text-tertiary);
  font-size: 12px;
}

.arrow-rate {
  font-size: 14px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  margin: 4px 0 2px;
  font-family: monospace;
}

.arrow-caption {
  font-size: 11px;
  color: var(--wm-text-tertiary);
}

.funnel-overall {
  margin-top: 16px;
  padding: 12px;
  background: rgba(99, 102, 241, 0.06);
  border-radius: 8px;
  font-size: 13px;
  color: var(--wm-text-secondary);
  text-align: center;
}

.overall-rate {
  font-size: 18px;
  font-weight: 800;
  color: var(--wm-accent-primary);
  font-family: monospace;
  margin: 0 4px;
}

/* P0-3 v2 漏斗扩展样式 */
.funnel-tags {
  display: flex;
  gap: 6px;
}

.funnel-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed var(--wm-border-default);
}

.funnel-block:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.block-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--wm-text-secondary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 小尺寸 funnel */
.funnel-wrap.small {
  gap: 6px;
}

.step-value-sm {
  font-size: 20px;
  font-weight: 800;
  color: var(--wm-text-primary);
  font-family: 'SF Mono', Monaco, monospace;
}

.funnel-overall-sm {
  margin-top: 8px;
  font-size: 12px;
  color: var(--wm-text-secondary);
  text-align: center;
}

.overall-rate-sm {
  font-size: 14px;
  font-weight: 800;
  color: var(--wm-accent-primary);
  font-family: monospace;
  margin-left: 4px;
}

/* 新/回访拆分 */
.split-wrap {
  display: flex;
  align-items: stretch;
  gap: 16px;
}

.split-section {
  flex: 1;
  padding: 12px;
  background: rgba(99, 102, 241, 0.03);
  border-radius: 8px;
}

.split-divider {
  width: 1px;
  background: var(--wm-border-default);
}

.split-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin-bottom: 10px;
}

.split-sub {
  font-weight: 400;
  color: var(--wm-text-tertiary);
  font-size: 11px;
  margin-left: 4px;
}

/* Top 3 产品漏斗 */
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.product-card {
  padding: 14px;
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: 8px;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.product-stats {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--wm-text-secondary);
  margin-bottom: 10px;
}

.product-stats b.highlight {
  color: var(--wm-accent-success);
}

.product-funnel {
  font-size: 12px;
}

.pf-item.uv {
  color: var(--wm-accent-primary);
  font-weight: 600;
  margin-bottom: 4px;
}

.pf-bar {
  width: 100%;
  height: 6px;
  background: var(--wm-bg-hover);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.pf-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--wm-accent-primary) 0%, var(--wm-accent-tertiary) 100%);
  border-radius: 3px;
  transition: width 0.6s ease;
}

.pf-paid {
  color: var(--wm-accent-success);
  font-weight: 500;
}

/* 每日 mini funnel */
.daily-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.daily-funnel {
  padding: 10px 6px;
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: 6px;
  text-align: center;
}

.daily-date {
  font-size: 11px;
  color: var(--wm-text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.daily-numbers {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-bottom: 4px;
}

.dn {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dn-num {
  font-size: 14px;
  font-weight: 800;
  font-family: monospace;
  color: var(--wm-text-primary);
}

.dn-lbl {
  font-size: 9px;
  color: var(--wm-text-tertiary);
  text-transform: uppercase;
}

.dn.uv .dn-num {
  color: var(--wm-accent-primary);
}
.dn.ord .dn-num {
  color: var(--wm-accent-warning);
}
.dn.paid .dn-num {
  color: var(--wm-accent-success);
}

.dn-arr {
  font-size: 10px;
  color: var(--wm-text-tertiary);
  margin-top: -8px;
}

.daily-rate {
  font-size: 13px;
  font-weight: 800;
  color: var(--wm-accent-primary);
  font-family: monospace;
}

@media (max-width: 768px) {
  .daily-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .split-wrap {
    flex-direction: column;
  }
  .split-divider {
    width: 100%;
    height: 1px;
  }
}
</style>
