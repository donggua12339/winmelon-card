<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';
import { get, post } from '@/api/http';

interface WithdrawalItem {
  id: string;
  merchant: { id: string; name: string; code: string; contactEmail: string };
  amount: number;
  fee: number;
  actual: number;
  method: 'ALIPAY' | 'WECHAT' | 'BANK' | 'USDT';
  status: 'PENDING' | 'APPROVING' | 'PAID' | 'REJECTED' | 'FAILED';
  rejectReason?: string | null;
  transferRef?: string | null;
  requestedAt: string;
  processedAt?: string | null;
}

const list = ref<WithdrawalItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const filterStatus = ref<string>('');

const showReject = ref(false);
const showPaid = ref(false);
const currentId = ref('');
const rejectForm = reactive({ reason: '' });
const paidForm = reactive({ transferRef: '' });
const rejectFormRef = ref<FormInstance>();
const paidFormRef = ref<FormInstance>();
const submitting = ref(false);

void ({} as Record<string, Record<string, string>>);
const statusText = (s: WithdrawalItem['status']) => {
  const map: Record<WithdrawalItem['status'], { text: string; type: string }> = {
    PENDING: { text: '待审核', type: 'warning' },
    APPROVING: { text: '审核通过待打款', type: 'info' },
    PAID: { text: '已打款', type: 'success' },
    REJECTED: { text: '已拒绝', type: 'danger' },
    FAILED: { text: '打款失败', type: 'danger' },
  };
  return map[s] ?? { text: s, type: 'info' };
};

const statusTypeOf = (s: WithdrawalItem['status']): 'success' | 'info' | 'warning' | 'danger' | 'primary' => {
  return statusText(s).type as 'success' | 'info' | 'warning' | 'danger' | 'primary';
};

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: WithdrawalItem[]; total: number }>('/withdrawal/admin/list', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        status: filterStatus.value || undefined,
      },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function onApprove(row: WithdrawalItem): Promise<void> {
  await ElMessageBox.confirm(
    `确认审核通过？\n\n商户：${row.merchant.name}\n金额：¥${row.amount}\n实际到账：¥${row.actual}\n方式：${row.method}`,
    '审核通过',
    { type: 'success' },
  );
  await post(`/withdrawal/admin/${row.id}/approve`);
  ElMessage.success('已审核通过，请尽快打款');
  await fetchList();
}

function onRejectOpen(row: WithdrawalItem): void {
  currentId.value = row.id;
  rejectForm.reason = '';
  showReject.value = true;
}

async function onReject(): Promise<void> {
  if (!rejectFormRef.value) return;
  const valid = await rejectFormRef.value.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await post(`/withdrawal/admin/${currentId.value}/reject`, { reason: rejectForm.reason });
    ElMessage.success('已拒绝，金额已退回商户');
    showReject.value = false;
    await fetchList();
  } finally {
    submitting.value = false;
  }
}

function onPaidOpen(row: WithdrawalItem): void {
  currentId.value = row.id;
  paidForm.transferRef = '';
  showPaid.value = true;
}

async function onPaid(): Promise<void> {
  if (!paidFormRef.value) return;
  const valid = await paidFormRef.value.validate().catch(() => false);
  if (!valid) return;
  submitting.value = true;
  try {
    await post(`/withdrawal/admin/${currentId.value}/paid`, { transferRef: paidForm.transferRef });
    ElMessage.success('已标记为已打款');
    showPaid.value = false;
    await fetchList();
  } finally {
    submitting.value = false;
  }
}

onMounted(fetchList);
</script>

<template>
  <div v-loading="loading" class="withdrawals-admin">
    <!-- 筛选 -->
    <div class="filter-bar">
      <el-radio-group v-model="filterStatus" @change="fetchList">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="PENDING">待审核</el-radio-button>
        <el-radio-button value="APPROVING">待打款</el-radio-button>
        <el-radio-button value="PAID">已打款</el-radio-button>
        <el-radio-button value="REJECTED">已拒绝</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="list" border empty-text="暂无提现记录">
      <el-table-column label="申请时间" width="160">
        <template #default="{ row }">{{ new Date(row.requestedAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="商户" min-width="180">
        <template #default="{ row }">
          <div>{{ row.merchant.name }}</div>
          <div style="font-size: 12px; color: #94a3b8">{{ row.merchant.code }}</div>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="100" align="right">
        <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="手续费" width="80" align="right">
        <template #default="{ row }">¥{{ row.fee.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="实际到账" width="100" align="right">
        <template #default="{ row }"
          ><strong style="color: #10b981">¥{{ row.actual.toFixed(2) }}</strong></template
        >
      </el-table-column>
      <el-table-column label="方式" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.method === 'ALIPAY'" type="primary" size="small">支付宝</el-tag>
          <el-tag v-else-if="row.method === 'WECHAT'" type="success" size="small">微信</el-tag>
          <el-tag v-else-if="row.method === 'BANK'" size="small">银行卡</el-tag>
          <el-tag v-else type="warning" size="small">USDT</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="130">
        <template #default="{ row }">
          <el-tag :type="statusTypeOf(row.status)">
            {{ statusText(row.status).text }}
          </el-tag>
          <div v-if="row.rejectReason" style="font-size: 11px; color: #ef4444; margin-top: 2px">
            {{ row.rejectReason }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="流水号" min-width="140">
        <template #default="{ row }">
          <code v-if="row.transferRef" style="font-size: 11px">{{ row.transferRef }}</code>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="处理时间" width="140">
        <template #default="{ row }">
          {{ row.processedAt ? new Date(row.processedAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'PENDING'" link type="success" size="small" @click="onApprove(row)">
            通过
          </el-button>
          <el-button v-if="row.status === 'PENDING'" link type="danger" size="small" @click="onRejectOpen(row)">
            拒绝
          </el-button>
          <el-button v-if="row.status === 'APPROVING'" link type="primary" size="small" @click="onPaidOpen(row)">
            标记已打款
          </el-button>
          <span v-if="row.status === 'PAID' || row.status === 'REJECTED'" style="color: #94a3b8">已完成</span>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="prev, pager, next"
      class="pagination"
      @current-change="fetchList"
    />

    <!-- 拒绝对话框 -->
    <el-dialog v-model="showReject" title="拒绝提现" width="480px">
      <el-form ref="rejectFormRef" :model="rejectForm" label-width="80px">
        <el-form-item
          label="原因"
          prop="reason"
          :rules="{ required: true, message: '请填写拒绝原因', trigger: 'blur' }"
        >
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请说明拒绝原因（1-500 字）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <el-alert type="warning" :closable="false" style="margin: 0 24px"> 拒绝后金额将自动退回商户可用余额。 </el-alert>
      <template #footer>
        <el-button @click="showReject = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="onReject">确认拒绝</el-button>
      </template>
    </el-dialog>

    <!-- 标记已打款对话框 -->
    <el-dialog v-model="showPaid" title="标记已打款" width="480px">
      <el-alert type="info" :closable="false" style="margin-bottom: 16px">
        <template #title>打款流程</template>
        1. 复制下方收款账号去支付宝/微信/银行手动转账<br />
        2. 转账完成后填写流水号/交易号<br />
        3. 点击"确认"后冻结金额将清除
      </el-alert>
      <el-form ref="paidFormRef" :model="paidForm" label-width="100px">
        <el-form-item
          label="打款流水号"
          prop="transferRef"
          :rules="{ required: true, message: '请填写打款流水号/交易号', trigger: 'blur' }"
        >
          <el-input
            v-model="paidForm.transferRef"
            placeholder="如：支付宝交易号 2026...1234"
            maxlength="128"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPaid = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onPaid">确认已打款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.withdrawals-admin {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.filter-bar {
  margin-bottom: 16px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
