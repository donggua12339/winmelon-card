<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { get } from '@/api/http';

interface DashboardStats {
  today: { orders: number; paidOrders: number; revenue: number };
  month: { paidOrders: number; revenue: number; grossRevenue: number };
  pendingOrders: number;
  totalOrders: number;
  repurchaseRate: number;
  topProducts: { productId: string; productName: string; sold: number; revenue: number }[];
  trend7d: { date: string; orders: number; revenue: number }[];
}

const stats = ref<DashboardStats | null>(null);
const loading = ref(false);

async function fetchStats(): Promise<void> {
  loading.value = true;
  try {
    stats.value = await get<DashboardStats>('/merchant/dashboard/stats');
  } finally {
    loading.value = false;
  }
}

function formatMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

onMounted(fetchStats);
</script>

<template>
  <div v-loading="loading" class="merchant-dashboard">
    <h2 class="page-title">数据看板</h2>

    <!-- 核心指标 -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">今日订单</div>
        <div class="kpi-value">{{ stats?.today.orders ?? 0 }}</div>
        <div class="kpi-sub">已支付 {{ stats?.today.paidOrders ?? 0 }}</div>
      </div>
      <div class="kpi-card kpi-revenue">
        <div class="kpi-label">今日收入</div>
        <div class="kpi-value">{{ formatMoney(stats?.today.revenue ?? 0) }}</div>
        <div class="kpi-sub">实时统计</div>
      </div>
      <div class="kpi-card kpi-pending">
        <div class="kpi-label">待处理订单</div>
        <div class="kpi-value">{{ stats?.pendingOrders ?? 0 }}</div>
        <div class="kpi-sub">需关注</div>
      </div>
      <div class="kpi-card kpi-rate">
        <div class="kpi-label">本月复购率</div>
        <div class="kpi-value">{{ stats?.repurchaseRate ?? 0 }}%</div>
        <div class="kpi-sub">本月数据</div>
      </div>
    </div>

    <!-- 本月汇总 -->
    <div class="section">
      <h3>本月汇总</h3>
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="metric">
            <span class="metric-label">订单数</span>
            <span class="metric-value">{{ stats?.month.paidOrders ?? 0 }}</span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="metric">
            <span class="metric-label">销售额</span>
            <span class="metric-value">{{ formatMoney(stats?.month.revenue ?? 0) }}</span>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="metric">
            <span class="metric-label">总交易额</span>
            <span class="metric-value">{{ formatMoney(stats?.month.grossRevenue ?? 0) }}</span>
          </div>
        </el-col>
      </el-row>
    </div>

    <!-- Top 5 商品 -->
    <div class="section">
      <h3>本月销量 Top 5</h3>
      <el-table :data="stats?.topProducts ?? []" border>
        <el-table-column label="排名" type="index" width="60" />
        <el-table-column label="商品名称" prop="productName" />
        <el-table-column label="销量" prop="sold" width="100" align="right" />
        <el-table-column label="销售额" width="140" align="right">
          <template #default="{ row }">{{ formatMoney(row.revenue) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!stats?.topProducts.length" description="本月暂无销售数据" />
    </div>

    <!-- 7 天趋势 -->
    <div class="section">
      <h3>最近 7 天订单趋势</h3>
      <el-table :data="stats?.trend7d ?? []" border>
        <el-table-column label="日期" prop="date" width="120" />
        <el-table-column label="订单数" prop="orders" width="120" align="right" />
        <el-table-column label="销售额" align="right">
          <template #default="{ row }">{{ formatMoney(row.revenue) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!stats?.trend7d.length" description="暂无趋势数据" />
    </div>
  </div>
</template>

<style scoped>
.merchant-dashboard {
  max-width: 1200px;
}

.page-title {
  margin: 0 0 24px;
  font-size: 22px;
  font-weight: 700;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.kpi-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 4px solid var(--el-color-primary);
}

.kpi-card.kpi-revenue {
  border-left-color: #67c23a;
}
.kpi-card.kpi-pending {
  border-left-color: #e6a23c;
}
.kpi-card.kpi-rate {
  border-left-color: #f56c6c;
}

.kpi-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.2;
  font-family: var(--el-font-family-monospace, monospace);
}

.kpi-sub {
  font-size: 12px;
  color: var(--el-text-color-tertiary);
  margin-top: 4px;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.metric {
  background: var(--el-fill-color-light);
  padding: 16px;
  border-radius: 6px;
  text-align: center;
}

.metric-label {
  display: block;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.metric-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  font-family: var(--el-font-family-monospace, monospace);
  color: var(--el-color-primary);
}
</style>
