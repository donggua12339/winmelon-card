<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post } from '@/api/http';

interface Application {
  id: string;
  contactEmail: string;
  merchantName: string;
  shopName: string;
  shopCode: string;
  businessScope: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason: string | null;
  reviewedAt: string | null;
  approvedMerchantId: string | null;
  createdAt: string;
}

const loading = ref(false);
const list = ref<Application[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref('');

const resultVisible = ref(false);
const resultData = ref<{ username: string; initialPassword: string; merchantId: string } | null>(null);

const rejectVisible = ref(false);
const rejectId = ref('');
const rejectReason = ref('');

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: Application[]; total: number }>('/admin/merchant-applications', {
      params: { page: page.value, pageSize: pageSize.value, status: statusFilter.value || undefined },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function onApprove(row: Application): Promise<void> {
  await ElMessageBox.confirm(
    `确认通过「${row.merchantName}」的入驻申请？通过后将自动创建商户、店铺和登录账号。`,
    '审核确认',
    { type: 'warning' },
  );
  try {
    const res = await post<{ username: string; initialPassword: string; merchantId: string }>(
      `/admin/merchant-applications/${row.id}/approve`,
    );
    resultData.value = res;
    resultVisible.value = true;
    ElMessage.success('审核通过');
    fetchList();
  } catch {
    // 错误已由 http 拦截器提示
  }
}

function openReject(row: Application): void {
  rejectId.value = row.id;
  rejectReason.value = '';
  rejectVisible.value = true;
}

async function onReject(): Promise<void> {
  if (!rejectReason.value) {
    ElMessage.warning('请填写拒绝原因');
    return;
  }
  try {
    await post(`/admin/merchant-applications/${rejectId.value}/reject`, { reason: rejectReason.value });
    ElMessage.success('已拒绝');
    rejectVisible.value = false;
    fetchList();
  } catch {
    // 错误已由 http 拦截器提示
  }
}

function statusTag(s: Application['status']): { type: string; text: string } {
  const map = {
    PENDING: { type: 'warning', text: '待审核' },
    APPROVED: { type: 'success', text: '已通过' },
    REJECTED: { type: 'danger', text: '已拒绝' },
  } as const;
  return map[s];
}

function formatTime(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}

onMounted(fetchList);
</script>

<template>
  <div>
    <div class="page-header">
      <h2>商户入驻审核</h2>
      <div class="actions">
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 120px" @change="fetchList">
          <el-option label="待审核" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已拒绝" value="REJECTED" />
        </el-select>
        <el-button @click="fetchList">刷新</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column prop="createdAt" label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="merchantName" label="商户名称" min-width="120" />
      <el-table-column prop="shopName" label="店铺名称" min-width="120" />
      <el-table-column prop="shopCode" label="店铺码" width="120" />
      <el-table-column prop="contactEmail" label="邮箱" min-width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag(row.status).type as any">{{ statusTag(row.status).text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'PENDING'">
            <el-button link type="success" size="small" @click="onApprove(row as Application)">通过</el-button>
            <el-button link type="danger" size="small" @click="openReject(row as Application)">拒绝</el-button>
          </template>
          <span v-else class="muted">{{ formatTime(row.reviewedAt) }}</span>
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

    <!-- 审核通过结果 -->
    <el-dialog v-model="resultVisible" title="审核通过 - 账号信息" width="480px">
      <template v-if="resultData">
        <el-alert type="warning" :closable="false" show-icon title="请妥善保存以下信息，密码仅显示一次"> </el-alert>
        <div class="result-info">
          <div class="result-row">
            <span class="label">登录用户名</span>
            <code>{{ resultData.username }}</code>
          </div>
          <div class="result-row">
            <span class="label">初始密码</span>
            <code class="password">{{ resultData.initialPassword }}</code>
          </div>
          <div class="result-row">
            <span class="label">商户 ID</span>
            <code>{{ resultData.merchantId }}</code>
          </div>
        </div>
        <div class="tip">请把账号信息发给商户，商户登录后请立即修改密码</div>
      </template>
      <template #footer>
        <el-button type="primary" @click="resultVisible = false">已记录</el-button>
      </template>
    </el-dialog>

    <!-- 拒绝弹窗 -->
    <el-dialog v-model="rejectVisible" title="拒绝申请" width="440px">
      <el-form>
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectReason"
            type="textarea"
            :rows="3"
            placeholder="如：店铺名称不合规，请修改后重新申请"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" @click="onReject">确认拒绝</el-button>
      </template>
    </el-dialog>
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

.actions {
  display: flex;
  gap: 8px;
}

.muted {
  color: var(--wm-text-tertiary);
  font-size: 12px;
}

.result-info {
  margin-top: 16px;
  padding: 16px;
  background: var(--wm-glass-bg);
  border-radius: var(--wm-radius-md);
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.result-row .label {
  color: var(--wm-text-secondary);
  font-size: 13px;
}

.result-row code {
  font-family: var(--wm-font-mono);
  font-size: 14px;
  background: rgba(0, 0, 0, 0.3);
  padding: 4px 10px;
  border-radius: 4px;
}

.result-row .password {
  color: var(--wm-accent-pink);
  font-weight: 700;
}

.tip {
  margin-top: 12px;
  color: var(--wm-text-tertiary);
  font-size: 12px;
}
</style>
