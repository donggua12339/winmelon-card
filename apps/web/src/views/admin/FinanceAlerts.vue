<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post } from '@/api/http';

interface Alert {
  id: string;
  snapshotAt: string;
  type: string;
  description: string;
  diffAmount: string;
  severity: 'WARNING' | 'ERROR' | 'CRITICAL';
  notifiedAt: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

const loading = ref(false);
const list = ref<Alert[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showResolved = ref(false);

const TYPE_LABELS: Record<string, string> = {
  BALANCE_MISMATCH: '资金平衡差异',
  INCOME_MISMATCH: '收入差异',
  REFUND_MISMATCH: '退款差异',
};
const SEVERITY_TYPES: Record<Alert['severity'], 'warning' | 'danger' | 'info'> = {
  WARNING: 'warning',
  ERROR: 'danger',
  CRITICAL: 'danger',
};

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: Alert[]; total: number }>('/admin/finance/alerts', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        resolved: showResolved.value ? 'true' : 'false',
      },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function formatTime(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}

async function onResolve(row: Alert): Promise<void> {
  let note = '';
  try {
    const { value } = await ElMessageBox.prompt('请填写解决方案（必填）', '标记已解决', {
      inputType: 'textarea',
      inputValidator: (v) => (v && v.trim().length > 0 ? true : '请填写解决方案'),
      inputPlaceholder: '例如：已确认是商户手动调整，差额已记账',
    });
    note = value.trim();
  } catch {
    return;
  }
  try {
    await post(`/admin/finance/alerts/${row.id}/resolve?note=${encodeURIComponent(note)}`);
    ElMessage.success('已标记解决');
    fetchList();
  } catch {
    /* http 拦截器已提示 */
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">财务对账告警</h2>
        <p class="page-desc">资金平衡、收入、退款差异自动检测</p>
      </div>
      <div class="actions">
        <el-switch v-model="showResolved" active-text="显示已解决" inactive-text="仅未解决" @change="fetchList" />
        <el-button @click="fetchList">刷新</el-button>
      </div>
    </header>

    <section class="panel">
      <el-table v-loading="loading" :data="list" :border="false" stripe>
        <el-table-column label="严重度" width="100">
          <template #default="{ row }">
            <el-tag :type="SEVERITY_TYPES[(row as Alert).severity]" size="small">
              {{ (row as Alert).severity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="140">
          <template #default="{ row }">{{ TYPE_LABELS[(row as Alert).type] || (row as Alert).type }}</template>
        </el-table-column>
        <el-table-column label="差异金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount amount-danger">¥{{ (row as Alert).diffAmount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="380" show-overflow-tooltip />
        <el-table-column label="告警时间" width="170">
          <template #default="{ row }">{{ formatTime((row as Alert).notifiedAt) }}</template>
        </el-table-column>
        <el-table-column label="快照时间" width="170">
          <template #default="{ row }">{{ formatTime((row as Alert).snapshotAt) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="(row as Alert).resolved" type="success" size="small">已解决</el-tag>
            <el-tag v-else type="warning" size="small">未解决</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!(row as Alert).resolved"
              link
              type="success"
              size="small"
              @click="onResolve(row as Alert)"
            >
              标记解决
            </el-button>
            <span v-else class="text-tertiary text-sm">
              {{ formatTime((row as Alert).resolvedAt) }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pagination"
        @current-change="fetchList"
      />
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
  gap: var(--wm-space-md);
  align-items: center;
}

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.pagination {
  margin-top: var(--wm-space-lg);
  justify-content: flex-end;
  display: flex;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.amount-danger {
  color: var(--wm-accent-danger);
}

.text-tertiary {
  color: var(--wm-text-tertiary);
}

.text-sm {
  font-size: 12px;
}
</style>
