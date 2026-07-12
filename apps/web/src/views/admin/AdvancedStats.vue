<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { get } from '@/api/http';

interface HourlyData {
  hours: string[];
  counts: number[];
  total: number;
  peak: number;
}
interface FunnelData {
  stages: { name: string; count: number }[];
  rates: { orderToPaid: number; paidToDelivered: number; overall: number };
}
interface RetentionData {
  totalBuyers: number;
  repeatBuyers: number;
  rate: number;
  topBuyers: { email: string; count: number }[];
}
interface SummaryData {
  days: number;
  paidOrders: number;
  revenue: number;
  avgOrderValue: number;
}

const days = ref(7);
const loading = ref(false);

const hourly = ref<HourlyData | null>(null);
const funnel = ref<FunnelData | null>(null);
const retention = ref<RetentionData | null>(null);
const summary = ref<SummaryData | null>(null);

const hourlyEl = ref<HTMLDivElement | null>(null);
const funnelEl = ref<HTMLDivElement | null>(null);
const retentionEl = ref<HTMLDivElement | null>(null);
const hourlyChart = ref<echarts.ECharts | null>(null);
const funnelChart = ref<echarts.ECharts | null>(null);
const retentionChart = ref<echarts.ECharts | null>(null);

async function fetchAll(): Promise<void> {
  loading.value = true;
  try {
    const [h, f, r, s] = await Promise.all([
      get<HourlyData>('/admin/stats/hourly', { params: { days: days.value } }),
      get<FunnelData>('/admin/stats/funnel', { params: { days: days.value } }),
      get<RetentionData>('/admin/stats/retention', { params: { days: days.value } }),
      get<SummaryData>('/admin/stats/summary', { params: { days: days.value } }),
    ]);
    hourly.value = h;
    funnel.value = f;
    retention.value = r;
    summary.value = s;
    await nextTick();
    renderAll();
  } finally {
    loading.value = false;
  }
}

function renderHourly(): void {
  if (!hourlyEl.value || !hourly.value) return;
  if (!hourlyChart.value) hourlyChart.value = echarts.init(hourlyEl.value);
  hourlyChart.value.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category',
      data: hourly.value.hours,
      axisLabel: { color: '#94a3b8', interval: 1 },
      axisLine: { lineStyle: { color: '#475569' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        type: 'bar',
        data: hourly.value.counts.map((c, i) => ({
          value: c,
          itemStyle: i === hourly.value!.peak ? { color: '#f472b6' } : { color: '#7c3aed' },
        })),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  });
}

function renderFunnel(): void {
  if (!funnelEl.value || !funnel.value) return;
  if (!funnelChart.value) funnelChart.value = echarts.init(funnelEl.value);
  funnelChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'funnel',
        left: '10%',
        right: '10%',
        top: 20,
        bottom: 20,
        width: '80%',
        gap: 2,
        label: { color: '#f1f5f9', fontSize: 13 },
        itemStyle: { borderColor: '#0f1424', borderWidth: 2 },
        data: funnel.value.stages.map((s, i) => ({
          name: s.name,
          value: s.count,
          itemStyle: {
            color: ['#7c3aed', '#06b6d4', '#34d399'][i] ?? '#7c3aed',
          },
        })),
      },
    ],
  });
}

function renderRetention(): void {
  if (!retentionEl.value || !retention.value) return;
  if (!retentionChart.value) retentionChart.value = echarts.init(retentionEl.value);
  retentionChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { textStyle: { color: '#cbd5e1' }, bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#0f1424', borderWidth: 2 },
        label: { color: '#cbd5e1' },
        data: [
          { name: '复购买家', value: retention.value.repeatBuyers, itemStyle: { color: '#7c3aed' } },
          {
            name: '单次买家',
            value: retention.value.totalBuyers - retention.value.repeatBuyers,
            itemStyle: { color: '#06b6d4' },
          },
        ],
      },
    ],
  });
}

function renderAll(): void {
  renderHourly();
  renderFunnel();
  renderRetention();
}

function resizeAll(): void {
  hourlyChart.value?.resize();
  funnelChart.value?.resize();
  retentionChart.value?.resize();
}

watch(days, fetchAll);
onMounted(() => {
  fetchAll();
  window.addEventListener('resize', resizeAll);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeAll);
  hourlyChart.value?.dispose();
  funnelChart.value?.dispose();
  retentionChart.value?.dispose();
});
</script>

<template>
  <div v-loading="loading">
    <div class="page-header">
      <h2>高级统计</h2>
      <div class="header-actions">
        <el-radio-group v-model="days" size="small">
          <el-radio-button :value="7">7 天</el-radio-button>
          <el-radio-button :value="30">30 天</el-radio-button>
          <el-radio-button :value="90">90 天</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 汇总卡片 -->
    <div v-if="summary" class="summary-row">
      <div class="glass summary-card">
        <div class="summary-label">总收入</div>
        <div class="summary-value price-neon">¥{{ summary.revenue.toFixed(2) }}</div>
      </div>
      <div class="glass summary-card">
        <div class="summary-label">支付订单</div>
        <div class="summary-value text-cyan">{{ summary.paidOrders }}</div>
      </div>
      <div class="glass summary-card">
        <div class="summary-label">客单价</div>
        <div class="summary-value text-purple">¥{{ summary.avgOrderValue.toFixed(2) }}</div>
      </div>
      <div v-if="retention" class="glass summary-card">
        <div class="summary-label">复购率</div>
        <div class="summary-value text-pink">{{ retention.rate }}%</div>
      </div>
    </div>

    <!-- 图表网格 -->
    <div class="charts-grid">
      <div class="glass chart-card">
        <h3 class="chart-title">下单时段分布（24h）</h3>
        <div v-if="hourly" class="chart-subtitle">
          高峰时段：{{ hourly.hours[hourly.peak] }} · 总订单 {{ hourly.total }}
        </div>
        <div ref="hourlyEl" class="chart-box"></div>
      </div>

      <div class="glass chart-card">
        <h3 class="chart-title">转化漏斗</h3>
        <div v-if="funnel" class="chart-subtitle">
          下单->支付 {{ funnel.rates.orderToPaid }}% · 支付->发卡 {{ funnel.rates.paidToDelivered }}% · 整体
          {{ funnel.rates.overall }}%
        </div>
        <div ref="funnelEl" class="chart-box"></div>
      </div>

      <div class="glass chart-card">
        <h3 class="chart-title">复购率</h3>
        <div v-if="retention" class="chart-subtitle">
          {{ retention.repeatBuyers }} / {{ retention.totalBuyers }} 位买家复购
        </div>
        <div ref="retentionEl" class="chart-box"></div>
      </div>
    </div>

    <!-- TOP 买家 -->
    <div v-if="retention && retention.topBuyers.length > 0" class="glass top-buyers">
      <h3 class="chart-title">TOP 10 买家</h3>
      <el-table :data="retention.topBuyers" size="small" style="margin-top: 12px">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="count" label="购买次数" width="120" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.summary-card {
  padding: 20px;
}

.summary-label {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 800;
}

.text-cyan {
  color: var(--wm-accent-cyan);
}

.text-purple {
  color: var(--wm-accent-purple);
}

.text-pink {
  color: var(--wm-accent-pink);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.chart-card {
  padding: 20px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.chart-subtitle {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-top: 4px;
}

.chart-box {
  width: 100%;
  height: 280px;
  margin-top: 12px;
}

.top-buyers {
  padding: 20px;
}
</style>
