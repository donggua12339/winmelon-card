<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post } from '@/api/http';

interface DailyRow {
  date: string;
  revenue: string;
  refundAmount: string;
  netRevenue: string;
  orderCount: number;
  refundCount: number;
  refundRate: string;
}
interface DailyReport {
  days: DailyRow[];
  totals: { revenue: string; refundAmount: string; netRevenue: string; orderCount: number; refundCount: number };
}
interface ChannelRow {
  channel: string;
  revenue: string;
  refundAmount: string;
  fee: string;
  netRevenue: string;
}
interface MerchantRow {
  merchantId: string;
  merchantName: string;
  revenue: string;
  refundAmount: string;
  netRevenue: string;
}
interface ReportResp {
  daily: DailyReport;
  byChannel: ChannelRow[];
  byMerchant: MerchantRow[];
  toleranceYuan: number;
}

const loading = ref(false);
const report = ref<ReportResp | null>(null);
const days = ref<7 | 14 | 30>(7);
const toleranceYuan = ref(1);

async function fetchReport(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<ReportResp>('/admin/finance/daily-report', {
      params: { days: days.value },
    });
    report.value = data;
    toleranceYuan.value = data.toleranceYuan;
  } finally {
    loading.value = false;
  }
}

async function exportCsv(): Promise<void> {
  try {
    const token = localStorage.getItem('wm_access_token');
    const resp = await fetch(`/api/admin/finance/export?days=${days.value}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    if (!resp.ok) {
      ElMessage.error('导出失败');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-${days.value}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('已导出 CSV');
  } catch {
    ElMessage.error('导出失败');
  }
}

async function updateTolerance(): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(
      `当前容差 ¥${toleranceYuan.value}，新容差（元，0=零容忍）`,
      '设置对账容差',
      {
        inputPattern: /^\d+(\.\d+)?$/,
        inputErrorMessage: '请输入非负数',
        inputValue: String(toleranceYuan.value),
      },
    );
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      ElMessage.warning('请输入非负数');
      return;
    }
    const result = await post<{ toleranceYuan: number }>(`/admin/finance/tolerance?yuan=${n}`);
    toleranceYuan.value = result.toleranceYuan;
    ElMessage.success(`容差已更新为 ¥${n}`);
    fetchReport();
  } catch {
    /* 取消或 http 拦截器已提示 */
  }
}

function formatMoney(n: string | number): string {
  return `¥${Number(n).toFixed(2)}`;
}

onMounted(fetchReport);
</script>

<template>
  <div v-loading="loading" class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">财务对账</h2>
        <p class="page-desc">日表 / 通道 / 商户多维度收入与退款</p>
      </div>
      <div class="actions">
        <el-radio-group v-model="days" @change="fetchReport">
          <el-radio-button :value="7">7 天</el-radio-button>
          <el-radio-button :value="14">14 天</el-radio-button>
          <el-radio-button :value="30">30 天</el-radio-button>
        </el-radio-group>
        <el-button @click="fetchReport">刷新</el-button>
        <el-button type="primary" plain @click="exportCsv">导出 CSV</el-button>
        <el-button @click="updateTolerance">容差 ¥{{ toleranceYuan }}</el-button>
      </div>
    </header>

    <!-- 总览 -->
    <div v-if="report" class="stats-grid">
      <div class="stat-card stat-primary">
        <div class="stat-label">总收入</div>
        <div class="stat-value">{{ formatMoney(report.daily.totals.revenue) }}</div>
        <div class="stat-sub">{{ report.daily.totals.orderCount }} 笔已支付</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-label">总退款</div>
        <div class="stat-value">{{ formatMoney(report.daily.totals.refundAmount) }}</div>
        <div class="stat-sub">{{ report.daily.totals.refundCount }} 笔退款</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-label">净收入</div>
        <div class="stat-value">{{ formatMoney(report.daily.totals.netRevenue) }}</div>
        <div class="stat-sub">= 入账 - 退款</div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-label">退款率</div>
        <div class="stat-value">
          {{
            report.daily.totals.orderCount > 0
              ? ((report.daily.totals.refundCount / report.daily.totals.orderCount) * 100).toFixed(1)
              : '0.0'
          }}%
        </div>
        <div class="stat-sub">退款笔数 / 支付笔数</div>
      </div>
    </div>

    <!-- 日表 -->
    <section v-if="report" class="panel">
      <h3 class="panel-title">日表（{{ days }} 天）</h3>
      <el-table :data="report.daily.days" :border="false" stripe>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="总收入" width="120" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.revenue) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="总退款" width="120" align="right">
          <template #default="{ row }">
            <span class="amount amount-danger">{{ formatMoney(row.refundAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="净收入" width="120" align="right">
          <template #default="{ row }">
            <span :class="['amount', Number(row.netRevenue) >= 0 ? 'amount-success' : 'amount-danger']">{{
              formatMoney(row.netRevenue)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="100" align="right" />
        <el-table-column prop="refundCount" label="退款数" width="100" align="right" />
        <el-table-column prop="refundRate" label="退款率" width="100" align="right">
          <template #default="{ row }">
            <span
              :class="[
                'amount',
                Number(row.refundRate) > 10
                  ? 'amount-danger'
                  : Number(row.refundRate) > 5
                    ? 'amount-warning'
                    : 'amount-success',
              ]"
            >
              {{ row.refundRate }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <!-- 按通道 -->
    <section v-if="report && report.byChannel.length" class="panel">
      <h3 class="panel-title">按支付通道</h3>
      <el-table :data="report.byChannel" :border="false" stripe>
        <el-table-column prop="channel" label="通道" width="160" />
        <el-table-column label="总收入" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.revenue) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="总退款" align="right">
          <template #default="{ row }">
            <span class="amount amount-danger">{{ formatMoney(row.refundAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="手续费" align="right">
          <template #default="{ row }">
            <span class="amount amount-tertiary">{{ formatMoney(row.fee) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="净收入" align="right">
          <template #default="{ row }">
            <span
              :class="['amount', 'amount-strong', Number(row.netRevenue) >= 0 ? 'amount-success' : 'amount-danger']"
              >{{ formatMoney(row.netRevenue) }}</span
            >
          </template>
        </el-table-column>
      </el-table>
    </section>

    <!-- 按商户 -->
    <section v-if="report && report.byMerchant.length" class="panel">
      <h3 class="panel-title">按商户（Top）</h3>
      <el-table :data="report.byMerchant" :border="false" stripe>
        <el-table-column prop="merchantName" label="商户名" min-width="200" />
        <el-table-column label="总收入" align="right">
          <template #default="{ row }">
            <span class="amount">{{ formatMoney(row.revenue) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="总退款" align="right">
          <template #default="{ row }">
            <span class="amount amount-danger">{{ formatMoney(row.refundAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="净收入" align="right">
          <template #default="{ row }">
            <span
              :class="['amount', 'amount-strong', Number(row.netRevenue) >= 0 ? 'amount-success' : 'amount-danger']"
              >{{ formatMoney(row.netRevenue) }}</span
            >
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: var(--wm-container-max);
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--wm-space-lg);
  margin-bottom: var(--wm-space-xl);
  flex-wrap: wrap;
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

.actions {
  display: flex;
  gap: var(--wm-space-sm);
  align-items: center;
  flex-wrap: wrap;
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
  box-shadow: var(--wm-shadow-sm);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--card-color);
}

.stat-primary {
  --card-color: var(--wm-accent-primary);
}
.stat-success {
  --card-color: var(--wm-accent-success);
}
.stat-warning {
  --card-color: var(--wm-accent-warning);
}
.stat-danger {
  --card-color: var(--wm-accent-danger);
}

.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--wm-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.stat-sub {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-top: 6px;
}

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  margin-bottom: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 var(--wm-space-md);
  letter-spacing: -0.005em;
}

.amount {
  font-weight: 500;
  color: var(--wm-text-primary);
  font-variant-numeric: tabular-nums;
}

.amount-strong {
  font-weight: 700;
}

.amount-success {
  color: var(--wm-accent-success);
}

.amount-warning {
  color: var(--wm-accent-warning);
}

.amount-danger {
  color: var(--wm-accent-danger);
}

.amount-tertiary {
  color: var(--wm-text-tertiary);
}
</style>
