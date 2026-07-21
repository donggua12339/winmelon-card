<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { get, post, del } from '@/api/http';

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'AMOUNT' | 'FREE_SHIPPING';
  value: string;
  minSpend: string | null;
  validFrom: string | null;
  validTo: string | null;
  usageLimit: number | null;
  usedCount: number;
  shopId: string | null;
  note: string | null;
  createdAt: string;
}

const loading = ref(false);
const list = ref<Coupon[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();
const submitting = ref(false);
const form = reactive({
  type: 'PERCENT' as Coupon['type'],
  value: 50,
  minSpend: undefined as number | undefined,
  validTo: '',
  usageLimit: undefined as number | undefined,
  note: '',
});

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: Coupon[]; total: number }>('/admin/coupons', {
      params: { page: page.value, pageSize: pageSize.value },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  Object.assign(form, {
    type: 'PERCENT',
    value: 50,
    minSpend: undefined,
    validTo: '',
    usageLimit: undefined,
    note: '',
  });
  dialogVisible.value = true;
}

async function onSubmit(): Promise<void> {
  submitting.value = true;
  try {
    await post('/admin/coupons', {
      type: form.type,
      value: form.value,
      minSpend: form.minSpend,
      validTo: form.validTo || undefined,
      usageLimit: form.usageLimit,
      note: form.note || undefined,
    });
    ElMessage.success('券已创建');
    dialogVisible.value = false;
    fetchList();
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: Coupon): Promise<void> {
  await ElMessageBox.confirm(`确定删除券「${row.code}」？`, '危险操作', {
    type: 'error',
    confirmButtonText: '删除',
    confirmButtonClass: 'el-button--danger',
  });
  await del(`/admin/coupons/${row.id}`);
  ElMessage.success('已删除');
  fetchList();
}

function typeLabel(t: Coupon['type']): string {
  return { PERCENT: '百分比', AMOUNT: '固定金额', FREE_SHIPPING: '免运费' }[t];
}

function valueLabel(row: Coupon): string {
  if (row.type === 'PERCENT') return `${row.value}%`;
  if (row.type === 'AMOUNT') return `¥${row.value}`;
  return '-';
}

function formatTime(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">补贴券管理</h2>
        <p class="page-desc">创建促销券（百分比折扣 / 固定金额减免），用于活动补贴</p>
      </div>
      <div class="actions">
        <el-button @click="fetchList">刷新</el-button>
        <el-button type="primary" @click="openCreate">+ 创建券</el-button>
      </div>
    </header>

    <section class="panel">
      <el-table v-loading="loading" :data="list" :border="false" stripe>
        <el-table-column prop="code" label="券码" width="120" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ typeLabel((row as Coupon).type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="折扣值" width="100" align="right">
          <template #default="{ row }">{{ valueLabel(row as Coupon) }}</template>
        </el-table-column>
        <el-table-column label="最低消费" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.minSpend" class="amount">¥{{ row.minSpend }}</span>
            <span v-else class="text-tertiary">-</span>
          </template>
        </el-table-column>
        <el-table-column label="使用次数" width="120" align="right">
          <template #default="{ row }">
            <span class="amount">{{ row.usedCount }}</span>
            <span class="text-tertiary"> / {{ row.usageLimit ?? '∞' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="过期时间" width="170">
          <template #default="{ row }">{{ formatTime(row.validTo) }}</template>
        </el-table-column>
        <el-table-column prop="note" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="onDelete(row as Coupon)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" title="创建补贴券" width="480px">
      <el-form ref="formRef" :model="form" label-position="top">
        <el-form-item label="券类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option label="百分比折扣（如 50 = 半价）" value="PERCENT" />
            <el-option label="固定金额减免（如 5 = 减 5 元）" value="AMOUNT" />
          </el-select>
        </el-form-item>
        <el-form-item label="折扣值">
          <el-input-number v-model="form.value" :min="0" :max="form.type === 'PERCENT' ? 100 : 9999" :precision="2" />
          <span class="tip">{{ form.type === 'PERCENT' ? '%（0-100）' : '元' }}</span>
        </el-form-item>
        <el-form-item label="最低消费（可选）">
          <el-input-number v-model="form.minSpend" :min="0" :precision="2" placeholder="留空=无门槛" />
        </el-form-item>
        <el-form-item label="使用次数上限（可选）">
          <el-input-number v-model="form.usageLimit" :min="1" placeholder="留空=无限" />
        </el-form-item>
        <el-form-item label="过期时间（可选）">
          <el-date-picker v-model="form.validTo" type="datetime" placeholder="留空=永久有效" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.note" maxlength="255" placeholder="如：前 100 买家半价活动" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">创建</el-button>
      </template>
    </el-dialog>
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
  color: var(--wm-text-primary);
}

.text-tertiary {
  color: var(--wm-text-tertiary);
}

.tip {
  margin-left: var(--wm-space-sm);
  font-size: 12px;
  color: var(--wm-text-tertiary);
}
</style>
