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
  <div v-loading="loading">
    <div class="toolbar">
      <h2>财务对账</h2>
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
    </div>

    <!-- 总览 -->
    <div v-if="report" class="summary-grid">
      <div class="summary-card income">
        <div class="label">总收入</div>
        <div class="value">{{ formatMoney(report.daily.totals.revenue) }}</div>
        <div class="sub">{{ report.daily.totals.orderCount }} 笔已支付</div>
      </div>
      <div class="summary-card refund">
        <div class="label">总退款</div>
        <div class="value">{{ formatMoney(report.daily.totals.refundAmount) }}</div>
        <div class="sub">{{ report.daily.totals.refundCount }} 笔退款</div>
      </div>
      <div class="summary-card net">
        <div class="label">净收入</div>
        <div class="value">{{ formatMoney(report.daily.totals.netRevenue) }}</div>
        <div class="sub">= 入账 - 退款</div>
      </div>
      <div class="summary-card rate">
        <div class="label">退款率</div>
        <div class="value">
          {{
            report.daily.totals.orderCount > 0
              ? ((report.daily.totals.refundCount / report.daily.totals.orderCount) * 100).toFixed(1)
              : '0.0'
          }}%
        </div>
        <div class="sub">退款笔数 / 支付笔数</div>
      </div>
    </div>

    <!-- 日表 -->
    <el-card v-if="report" class="section-card" shadow="never">
      <template #header>
        <span class="section-title">📅 日表（{{ days }} 天）</span>
      </template>
      <el-table :data="report.daily.days" border>
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="总收入" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.revenue) }}</template>
        </el-table-column>
        <el-table-column label="总退款" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.refundAmount) }}</template>
        </el-table-column>
        <el-table-column label="净收入" width="120" align="right">
          <template #default="{ row }">
            <span :style="{ color: Number(row.netRevenue) >= 0 ? '#10b981' : '#ef4444' }">{{
              formatMoney(row.netRevenue)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="orderCount" label="订单数" width="100" align="right" />
        <el-table-column prop="refundCount" label="退款数" width="100" align="right" />
        <el-table-column prop="refundRate" label="退款率" width="100" align="right">
          <template #default="{ row }">
            <span
              :style="{
                color: Number(row.refundRate) > 10 ? '#ef4444' : Number(row.refundRate) > 5 ? '#f59e0b' : '#10b981',
              }"
            >
              {{ row.refundRate }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 按通道 -->
    <el-card v-if="report && report.byChannel.length" class="section-card" shadow="never">
      <template #header>
        <span class="section-title">💳 按支付通道</span>
      </template>
      <el-table :data="report.byChannel" border>
        <el-table-column prop="channel" label="通道" width="160" />
        <el-table-column label="总收入" align="right">
          <template #default="{ row }">{{ formatMoney(row.revenue) }}</template>
        </el-table-column>
        <el-table-column label="总退款" align="right">
          <template #default="{ row }">{{ formatMoney(row.refundAmount) }}</template>
        </el-table-column>
        <el-table-column label="手续费" align="right">
          <template #default="{ row }">{{ formatMoney(row.fee) }}</template>
        </el-table-column>
        <el-table-column label="净收入" align="right">
          <template #default="{ row }">
            <b :style="{ color: Number(row.netRevenue) >= 0 ? '#10b981' : '#ef4444' }">{{
              formatMoney(row.netRevenue)
            }}</b>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 按商户 -->
    <el-card v-if="report && report.byMerchant.length" class="section-card" shadow="never">
      <template #header>
        <span class="section-title">🏪 按商户（Top）</span>
      </template>
      <el-table :data="report.byMerchant" border>
        <el-table-column prop="merchantName" label="商户名" min-width="200" />
        <el-table-column label="总收入" align="right">
          <template #default="{ row }">{{ formatMoney(row.revenue) }}</template>
        </el-table-column>
        <el-table-column label="总退款" align="right">
          <template #default="{ row }">{{ formatMoney(row.refundAmount) }}</template>
        </el-table-column>
        <el-table-column label="净收入" align="right">
          <template #default="{ row }">
            <b :style="{ color: Number(row.netRevenue) >= 0 ? '#10b981' : '#ef4444' }">{{
              formatMoney(row.netRevenue)
            }}</b>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.summary-card {
  padding: 20px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}

.summary-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--card-color);
}

.summary-card.income {
  --card-color: #3b82f6;
}
.summary-card.refund {
  --card-color: #ef4444;
}
.summary-card.net {
  --card-color: #10b981;
}
.summary-card.rate {
  --card-color: #f59e0b;
}

.summary-card .label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 6px;
  font-weight: 500;
}

.summary-card .value {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
  font-family: monospace;
  letter-spacing: -0.02em;
}

.summary-card .sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.section-card {
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}
</style>
