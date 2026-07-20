<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, del } from '@/api/http';

interface InviteCode {
  id: string;
  code: string;
  note?: string | null;
  usedCount: number;
  createdAt: string;
}
interface Commission {
  id: string;
  orderNo: string;
  sourceMerchantName: string;
  baseAmount: number;
  rate: number;
  amount: number;
  status: string;
  createdAt: string;
}
interface InviteStats {
  totalCommission: number;
  monthCommission: number;
  codeCount: number;
  usedCodeCount: number;
  invitedMerchantCount: number;
}

const stats = ref<InviteStats>({
  totalCommission: 0,
  monthCommission: 0,
  codeCount: 0,
  usedCodeCount: 0,
  invitedMerchantCount: 0,
});
const codes = ref<InviteCode[]>([]);
const commissions = ref<Commission[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const newNote = ref('');

async function fetchAll(): Promise<void> {
  loading.value = true;
  try {
    const [s, c, cms] = await Promise.all([
      get<InviteStats>('/merchant/invite/stats'),
      get<InviteCode[]>('/merchant/invite-codes'),
      get<{ items: Commission[]; total: number }>('/merchant/commissions', {
        params: { page: 1, pageSize: 20 },
      }),
    ]);
    stats.value = s;
    codes.value = c;
    commissions.value = cms.items;
  } finally {
    loading.value = false;
  }
}

async function createCode(): Promise<void> {
  try {
    await post('/merchant/invite-codes', { note: newNote.value || undefined });
    ElMessage.success('邀请码已生成');
    dialogVisible.value = false;
    newNote.value = '';
    fetchAll();
  } catch {
    /* http 层已提示 */
  }
}

async function removeCode(c: InviteCode): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除邀请码「${c.code}」？`, '确认', { type: 'warning' });
    await del(`/merchant/invite-codes/${c.id}`);
    ElMessage.success('已删除');
    fetchAll();
  } catch {
    /* 取消 */
  }
}

function copyCode(code: string): void {
  navigator.clipboard.writeText(code);
  ElMessage.success(`已复制 ${code}`);
}

function formatMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

onMounted(fetchAll);
</script>

<template>
  <div v-loading="loading" class="invite-page">
    <h2>推广邀请</h2>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">总返佣收益</div>
        <div class="stat-value primary">{{ formatMoney(stats.totalCommission) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">本月返佣</div>
        <div class="stat-value">{{ formatMoney(stats.monthCommission) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">邀请码数量</div>
        <div class="stat-value">{{ stats.codeCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已邀请商户</div>
        <div class="stat-value">{{ stats.invitedMerchantCount }}</div>
      </div>
    </div>

    <!-- 邀请码 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>🎟️ 我的邀请码</span>
          <el-button type="primary" size="small" @click="dialogVisible = true">+ 生成邀请码</el-button>
        </div>
      </template>
      <el-table :data="codes" border>
        <el-table-column label="邀请码" width="160">
          <template #default="{ row }">
            <code class="code-text">{{ row.code }}</code>
            <el-button link size="small" @click="copyCode(row.code)">复制</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="note" label="备注" min-width="200" />
        <el-table-column prop="usedCount" label="使用次数" width="100" />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              size="small"
              :disabled="row.usedCount > 0"
              @click="removeCode(row as InviteCode)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 返佣记录 -->
    <el-card class="section-card" shadow="never">
      <template #header>
        <span>💰 返佣记录</span>
      </template>
      <el-table :data="commissions" border>
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="sourceMerchantName" label="来源商户" min-width="150" />
        <el-table-column label="基数" width="100">
          <template #default="{ row }">{{ formatMoney(row.baseAmount) }}</template>
        </el-table-column>
        <el-table-column label="比例" width="80">
          <template #default="{ row }">{{ (row.rate * 100).toFixed(1) }}%</template>
        </el-table-column>
        <el-table-column label="返佣" width="100">
          <template #default="{ row }">
            <strong style="color: #10b981">{{ formatMoney(row.amount) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'SETTLED' ? 'success' : 'warning'" size="small">
              {{ row.status === 'SETTLED' ? '已结算' : '已冲正' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="生成邀请码" width="400px">
      <el-input v-model="newNote" placeholder="备注（可选），如：某某渠道推广" maxlength="255" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createCode">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.invite-page {
  padding: 16px;
}
.invite-page h2 {
  margin: 0 0 16px;
  font-size: 18px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: #fff;
  border: 1px solid var(--wm-border-default);
  border-radius: 8px;
  padding: 16px;
}
.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 8px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--wm-text-primary);
}
.stat-value.primary {
  color: var(--wm-accent-success);
}
.section-card {
  margin-bottom: 16px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.code-text {
  font-family: monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  background: #f3e8ff;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
}
</style>
