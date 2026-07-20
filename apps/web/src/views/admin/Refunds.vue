<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post } from '@/api/http';

interface RefundItem {
  id: string;
  refundNo: string;
  amount: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED';
  initiator: 'BUYER' | 'PLATFORM';
  rejectReason: string | null;
  retryCount: number;
  manualPayout: boolean;
  tradeNo: string | null;
  createdAt: string;
  processedAt: string | null;
  paidAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
  alertSentAt: string | null;
  usdtTxHash: string | null;
  usdtSenderWallet: string | null;
  usdtReceiverWallet: string | null;
  order: { orderNo: string; totalAmount: string; buyerEmail: string };
}

const STATUS_LABELS: Record<RefundItem['status'], string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  PAID: '已退款',
  FAILED: '通道失败',
};
const STATUS_TYPES: Record<RefundItem['status'], 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  PENDING: 'warning',
  APPROVED: 'primary',
  REJECTED: 'info',
  PAID: 'success',
  FAILED: 'danger',
};
const INITIATOR_LABELS: Record<RefundItem['initiator'], string> = {
  BUYER: '买家申请',
  PLATFORM: '平台发起',
};
const MAX_RETRY = 3;

const loading = ref(false);
const list = ref<RefundItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref<RefundItem['status'] | ''>('');

// USDT 手动打款弹窗
const usdtDialogVisible = ref(false);
const usdtForm = ref({
  refundId: '',
  refundNo: '',
  amount: '',
  txHash: '',
  senderWallet: '',
  receiverWallet: '',
});
const usdtSubmitting = ref(false);

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: RefundItem[]; total: number; page: number; pageSize: number }>('/admin/refunds', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        status: statusFilter.value || undefined,
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

async function onApprove(row: RefundItem): Promise<void> {
  await ElMessageBox.confirm(`确定审核通过退款单 ${row.refundNo}？通过后需再执行"标记打款"完成退款。`, '审核通过', {
    type: 'warning',
  });
  try {
    await post(`/admin/refunds/${row.id}/approve`);
    ElMessage.success('已审核通过');
    fetchList();
  } catch {
    /* http 拦截器已提示 */
  }
}

async function onReject(row: RefundItem): Promise<void> {
  let rejectReason = '';
  try {
    const { value } = await ElMessageBox.prompt('请填写拒绝原因（必填）', '拒绝退款', {
      inputType: 'textarea',
      inputValidator: (v) => (v && v.trim().length > 0 ? true : '请填写拒绝原因'),
      inputPlaceholder: '请说明拒绝原因',
    });
    rejectReason = value.trim();
  } catch {
    return;
  }
  try {
    await post(`/admin/refunds/${row.id}/reject`, { rejectReason });
    ElMessage.success('已拒绝');
    fetchList();
  } catch {
    /* http 拦截器已提示 */
  }
}

/** T3: 通道退款（含自动重试调度） */
async function onMarkPaidChannel(row: RefundItem): Promise<void> {
  let tradeNo = '';
  try {
    const inputMode = await ElMessageBox({
      title: '通道退款方式',
      message: '默认自动调通道 API；如已通过其他渠道退款可手动输入 tradeNo。',
      showCancelButton: true,
      confirmButtonText: '自动调通道',
      cancelButtonText: '手动输入 tradeNo',
      distinguishCancelAndClose: true,
    }).catch(() => 'auto');
    if (inputMode === 'manual') {
      const { value } = await ElMessageBox.prompt('请输入通道退款流水号', '标记打款', {
        inputPlaceholder: '通道返回的 tradeNo',
        inputValidator: (v) => (v && v.trim().length > 0 ? true : '请输入流水号'),
      });
      tradeNo = value.trim();
    }
  } catch {
    return;
  }
  await doMarkPaid(row, false, tradeNo, false);
}

/** T3: USDT 手动打款 */
function openUsdtDialog(row: RefundItem): void {
  usdtForm.value = {
    refundId: row.id,
    refundNo: row.refundNo,
    amount: row.amount,
    txHash: '',
    senderWallet: '',
    receiverWallet: '',
  };
  usdtDialogVisible.value = true;
}

async function submitUsdtPayout(): Promise<void> {
  const f = usdtForm.value;
  if (!f.txHash.trim() || !f.senderWallet.trim() || !f.receiverWallet.trim()) {
    ElMessage.warning('请填写 TX Hash + 发送/接收钱包地址');
    return;
  }
  usdtSubmitting.value = true;
  try {
    await post(`/admin/refunds/${f.refundId}/mark-paid`, {
      manualPayout: true,
      usdt: {
        txHash: f.txHash.trim(),
        senderWallet: f.senderWallet.trim(),
        receiverWallet: f.receiverWallet.trim(),
      },
    });
    ElMessage.success(`USDT 手动打款已记录，退款完成`);
    usdtDialogVisible.value = false;
    fetchList();
  } catch {
    /* http 拦截器已提示 */
  } finally {
    usdtSubmitting.value = false;
  }
}

/** T3: 手动重试（admin 触发立即重试通道） */
async function onManualRetry(row: RefundItem): Promise<void> {
  await ElMessageBox.confirm(`手动重试退款 ${row.refundNo}？当前重试 ${row.retryCount}/${MAX_RETRY}。`, '手动重试', {
    type: 'warning',
  });
  try {
    const result = await post<{ status: string; retryCount: number }>(`/admin/refunds/${row.id}/retry`);
    if (result.status === 'PAID') {
      ElMessage.success('重试成功，已退款');
    } else {
      ElMessage.warning(`重试失败（${result.retryCount}/${MAX_RETRY}），已调度下次重试`);
    }
    fetchList();
  } catch {
    /* http 拦截器已提示 */
  }
}

async function doMarkPaid(
  row: RefundItem,
  manualPayout: boolean,
  tradeNo: string,
  forceOverride: boolean,
): Promise<void> {
  try {
    await post(`/admin/refunds/${row.id}/mark-paid`, {
      manualPayout,
      tradeNo: tradeNo || undefined,
      forceOverride,
    });
    ElMessage.success('已标记打款，退款完成');
    fetchList();
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (!forceOverride && (msg.includes('-¥1000') || msg.includes('强制覆盖'))) {
      try {
        await ElMessageBox.confirm(`${msg}\n\n是否允许强制覆盖 -¥1000 硬下限？`, '余额下限检查', {
          type: 'warning',
          confirmButtonText: '强制覆盖',
          cancelButtonText: '取消',
        });
        await doMarkPaid(row, manualPayout, tradeNo, true);
      } catch {
        /* 用户取消 */
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onMarkFailed(row: RefundItem): Promise<void> {
  let error = '';
  try {
    const { value } = await ElMessageBox.prompt('请输入失败原因', '标记通道退款失败', {
      inputType: 'textarea',
      inputValidator: (v) => (v && v.trim().length > 0 ? true : '请填写失败原因'),
    });
    error = value.trim();
  } catch {
    return;
  }
  try {
    const result = await post<{ retryCount: number }>(`/admin/refunds/${row.id}/mark-failed`, { error });
    if (result.retryCount >= MAX_RETRY) {
      ElMessage.error(`已达最大重试次数 ${MAX_RETRY}，请转 USDT 手动打款`);
    } else {
      ElMessage.warning(`已记录失败（重试 ${result.retryCount}/${MAX_RETRY}），下次 ${result.retryCount * 5} 分钟后`);
    }
    fetchList();
  } catch {
    /* http 拦截器已提示 */
  }
}

onMounted(fetchList);
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>退款管理</h2>
      <div class="actions">
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="fetchList">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
          <el-option label="已退款" value="PAID" />
          <el-option label="通道失败" value="FAILED" />
        </el-select>
        <el-button @click="fetchList">刷新</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="refundNo" label="退款单号" min-width="170" />
      <el-table-column label="关联订单" min-width="170">
        <template #default="{ row }">
          <div>{{ row.order.orderNo }}</div>
          <div style="font-size: 12px; color: #94a3b8">{{ row.order.buyerEmail }}</div>
        </template>
      </el-table-column>
      <el-table-column label="退款金额" width="100">
        <template #default="{ row }">¥{{ row.amount }}</template>
      </el-table-column>
      <el-table-column prop="initiator" label="发起方" width="90">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{
            INITIATOR_LABELS[row.initiator as keyof typeof INITIATOR_LABELS]
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="STATUS_TYPES[row.status as keyof typeof STATUS_TYPES]">
            {{ STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="退款原因" min-width="180" show-overflow-tooltip />
      <el-table-column label="打款方式" width="100">
        <template #default="{ row }">
          <span v-if="row.status === 'PAID'">{{ row.manualPayout ? '线下' : '通道' }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="重试" width="80">
        <template #default="{ row }">
          <span
            :style="{ color: row.retryCount >= MAX_RETRY ? '#ef4444' : row.retryCount > 0 ? '#f59e0b' : '#94a3b8' }"
          >
            {{ row.retryCount || 0 }}/{{ MAX_RETRY }}
          </span>
          <div v-if="row.nextRetryAt && row.status === 'FAILED'" style="font-size: 11px; color: #94a3b8">
            下次 {{ formatTime(row.nextRetryAt) }}
          </div>
          <div v-if="row.alertSentAt" style="font-size: 11px; color: #ef4444">已告警</div>
        </template>
      </el-table-column>
      <el-table-column label="最近失败" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.lastError" style="font-size: 12px; color: #94a3b8">{{ row.lastError }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="申请时间" width="160">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <template v-if="(row as RefundItem).status === 'PENDING'">
            <el-button link type="success" size="small" @click="onApprove(row as RefundItem)">通过</el-button>
            <el-button link type="danger" size="small" @click="onReject(row as RefundItem)">拒绝</el-button>
          </template>
          <template v-else-if="(row as RefundItem).status === 'APPROVED'">
            <el-button link type="primary" size="small" @click="onMarkPaidChannel(row as RefundItem)"
              >通道退款</el-button
            >
            <el-button link type="warning" size="small" @click="openUsdtDialog(row as RefundItem)">USDT 手动</el-button>
          </template>
          <template v-else-if="(row as RefundItem).status === 'FAILED'">
            <el-button
              v-if="(row as RefundItem).retryCount < MAX_RETRY"
              link
              type="primary"
              size="small"
              @click="onManualRetry(row as RefundItem)"
            >
              立即重试
            </el-button>
            <el-button link type="warning" size="small" @click="openUsdtDialog(row as RefundItem)">
              转 USDT 手动
            </el-button>
          </template>
          <template v-else>
            <span style="color: #94a3b8; font-size: 12px">
              {{ (row as RefundItem).processedAt ? formatTime((row as RefundItem).processedAt) : '-' }}
            </span>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 16px"
      @current-change="fetchList"
    />

    <!-- USDT 手动打款弹窗 -->
    <el-dialog v-model="usdtDialogVisible" title="USDT 链上打款" width="540px" :close-on-click-modal="false">
      <el-alert v-if="usdtForm.refundNo" type="info" :closable="false" show-icon style="margin-bottom: 16px">
        <template #title>
          退款单 <b>{{ usdtForm.refundNo }}</b
          >，金额 <b style="color: #ef4444">¥{{ usdtForm.amount }}</b>
        </template>
      </el-alert>
      <el-form label-position="top">
        <el-form-item label="链上交易 TX Hash（必填）" required>
          <el-input v-model="usdtForm.txHash" placeholder="例如 0x... 64 字符" maxlength="128" />
        </el-form-item>
        <el-form-item label="发送方钱包地址（必填）" required>
          <el-input v-model="usdtForm.senderWallet" placeholder="TRC20 钱包地址" maxlength="128" />
        </el-form-item>
        <el-form-item label="接收方钱包地址（必填）" required>
          <el-input v-model="usdtForm.receiverWallet" placeholder="买家提供的接收地址" maxlength="128" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="usdtDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="usdtSubmitting" @click="submitUsdtPayout">确认已打款</el-button>
      </template>
    </el-dialog>
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
}
</style>
