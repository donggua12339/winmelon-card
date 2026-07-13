<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { get, post } from '@/api/http';

interface Balance {
  balance: number;
  freezeBalance: number;
  available: number;
  totalWithdrawn: number;
  minAmount: number;
  feePercent: number;
  feeFixed: number;
}

interface WithdrawalItem {
  id: string;
  amount: number;
  fee: number;
  actual: number;
  method: string;
  status: 'PENDING' | 'APPROVING' | 'PAID' | 'REJECTED' | 'FAILED';
  rejectReason?: string | null;
  transferRef?: string | null;
  requestedAt: string;
  processedAt?: string | null;
}

const balance = ref<Balance | null>(null);
const list = ref<WithdrawalItem[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const showApply = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  amount: 0,
  method: 'ALIPAY' as 'ALIPAY' | 'WECHAT' | 'BANK' | 'USDT',
  account: '',
  name: '',
  bankName: '',
});

const rules: FormRules<typeof form> = {
  amount: [
    { required: true, message: '请输入提现金额', trigger: 'blur' },
    {
      validator: (_r, v: number, cb) => {
        if (!v || v < (balance.value?.minAmount ?? 10)) {
          return cb(new Error(`最低提现金额为 ¥${balance.value?.minAmount ?? 10}`));
        }
        if (v > (balance.value?.available ?? 0)) {
          return cb(new Error(`可提现余额不足：¥${balance.value?.available?.toFixed(2) ?? 0}`));
        }
        cb();
      },
      trigger: 'blur',
    },
  ],
  method: [{ required: true, message: '请选择提现方式', trigger: 'change' }],
  account: [{ required: true, message: '请输入收款账号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  bankName: [
    {
      validator: (_r, v: string, cb) => {
        if (form.method === 'BANK' && !v) return cb(new Error('银行卡需填写开户行'));
        cb();
      },
      trigger: 'blur',
    },
  ],
};

const fee = computed(() => {
  if (!balance.value) return 0;
  return +(balance.value.feeFixed + (form.amount * balance.value.feePercent) / 100).toFixed(2);
});
const actual = computed(() => +(form.amount - fee.value).toFixed(2));

const statusText = (s: WithdrawalItem['status']) => {
  const map: Record<WithdrawalItem['status'], { text: string; type: 'info' | 'success' | 'warning' | 'danger' }> = {
    PENDING: { text: '待审核', type: 'warning' },
    APPROVING: { text: '审核通过待打款', type: 'info' },
    PAID: { text: '已打款', type: 'success' },
    REJECTED: { text: '已拒绝', type: 'danger' },
    FAILED: { text: '打款失败', type: 'danger' },
  };
  return map[s] ?? { text: s, type: 'info' };
};

async function fetchBalance(): Promise<void> {
  balance.value = await get<Balance>('/withdrawal/merchant/balance');
}

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: WithdrawalItem[]; total: number }>('/withdrawal/merchant/list', {
      params: { page: page.value, pageSize: pageSize.value },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function onApply(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const accountInfo: Record<string, string> = { account: form.account, name: form.name };
    if (form.method === 'BANK') accountInfo.bankName = form.bankName;

    await post('/withdrawal/merchant/apply', {
      amount: form.amount,
      method: form.method,
      accountInfo,
    });
    ElMessage.success(`提现申请已提交，实际到账 ¥${actual.value}`);
    showApply.value = false;
    form.amount = 0;
    form.account = '';
    form.name = '';
    form.bankName = '';
    await fetchBalance();
    await fetchList();
  } catch {
    /* http 层处理 */
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await fetchBalance();
  await fetchList();
});
</script>

<template>
  <div v-loading="loading" class="withdrawals-page">
    <!-- 余额卡片 -->
    <div v-if="balance" class="balance-cards">
      <div class="balance-card balance-available">
        <div class="card-label">可提现余额</div>
        <div class="card-value">¥{{ balance.available.toFixed(2) }}</div>
        <div class="card-sub">
          总余额 ¥{{ balance.balance.toFixed(2) }} - 冻结 ¥{{ balance.freezeBalance.toFixed(2) }}
        </div>
      </div>
      <div class="balance-card balance-frozen">
        <div class="card-label">冻结金额</div>
        <div class="card-value">¥{{ balance.freezeBalance.toFixed(2) }}</div>
        <div class="card-sub">申请中/未到账</div>
      </div>
      <div class="balance-card balance-withdrawn">
        <div class="card-label">累计提现</div>
        <div class="card-value">¥{{ balance.totalWithdrawn.toFixed(2) }}</div>
        <div class="card-sub">历史已到账</div>
      </div>
    </div>

    <!-- 提示 + 申请按钮 -->
    <el-alert v-if="balance" type="info" :closable="false" class="tip-alert">
      <template #title>提现规则</template>
      最低提现金额 <strong>¥{{ balance.minAmount }}</strong
      >。
      <span v-if="balance.feePercent > 0 || balance.feeFixed > 0">
        手续费：每笔 {{ balance.feeFixed }} 元 + {{ balance.feePercent }}%。
      </span>
      <span v-else>当前免手续费。</span>
      T+0 立即可提现，平台审核后人工打款。
    </el-alert>

    <div class="action-bar">
      <h3 class="section-title">提现记录</h3>
      <el-button type="primary" :disabled="!balance || balance.available < balance.minAmount" @click="showApply = true">
        💰 申请提现
      </el-button>
    </div>

    <el-table :data="list" border empty-text="暂无提现记录">
      <el-table-column label="申请时间" width="160">
        <template #default="{ row }">{{ new Date(row.requestedAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="金额" width="120" align="right">
        <template #default="{ row }">¥{{ row.amount.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="手续费" width="100" align="right">
        <template #default="{ row }">¥{{ row.fee.toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="实际到账" width="120" align="right">
        <template #default="{ row }"
          ><strong>¥{{ row.actual.toFixed(2) }}</strong></template
        >
      </el-table-column>
      <el-table-column label="方式" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.method === 'ALIPAY'" type="primary">支付宝</el-tag>
          <el-tag v-else-if="row.method === 'WECHAT'" type="success">微信</el-tag>
          <el-tag v-else-if="row.method === 'BANK'">银行卡</el-tag>
          <el-tag v-else type="warning">USDT</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusText(row.status).type as any">
            {{ statusText(row.status).text }}
          </el-tag>
          <div v-if="row.rejectReason" style="font-size: 12px; color: #ef4444; margin-top: 4px">
            原因：{{ row.rejectReason }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="处理时间" width="160">
        <template #default="{ row }">
          {{ row.processedAt ? new Date(row.processedAt).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="流水号" min-width="160">
        <template #default="{ row }">
          <code v-if="row.transferRef" style="font-size: 12px">{{ row.transferRef }}</code>
          <span v-else>-</span>
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

    <!-- 申请提现对话框 -->
    <el-dialog v-model="showApply" title="申请提现" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="提现金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :min="balance?.minAmount ?? 10"
            :max="balance?.available ?? 0"
            :precision="2"
            :step="100"
            style="width: 100%"
          />
          <div class="form-tip">可提现 ¥{{ balance?.available.toFixed(2) ?? 0 }}</div>
        </el-form-item>
        <el-form-item label="提现方式" prop="method">
          <el-radio-group v-model="form.method">
            <el-radio value="ALIPAY">支付宝</el-radio>
            <el-radio value="WECHAT">微信</el-radio>
            <el-radio value="BANK">银行卡</el-radio>
            <el-radio value="USDT">USDT</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="真实姓名" prop="name">
          <el-input v-model="form.name" placeholder="收款人真实姓名" />
        </el-form-item>
        <el-form-item label="收款账号" prop="account">
          <el-input
            v-model="form.account"
            :placeholder="
              form.method === 'ALIPAY'
                ? '支付宝账号'
                : form.method === 'WECHAT'
                  ? '微信账号'
                  : form.method === 'BANK'
                    ? '银行卡号'
                    : 'TRC20 钱包地址'
            "
          />
        </el-form-item>
        <el-form-item v-if="form.method === 'BANK'" label="开户行" prop="bankName">
          <el-input v-model="form.bankName" placeholder="如：招商银行北京分行" />
        </el-form-item>
        <el-alert type="success" :closable="false" class="fee-preview">
          <template #title>本次提现预览</template>
          申请金额 ¥{{ form.amount.toFixed(2) }} - 手续费 ¥{{ fee.toFixed(2) }} =
          <strong>实际到账 ¥{{ actual.toFixed(2) }}</strong>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="showApply = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onApply">确认申请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.withdrawals-page {
  max-width: 1100px;
  margin: 0 auto;
}

.balance-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.balance-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid var(--balance-color, #cbd5e1);
}

.balance-available {
  --balance-color: #10b981;
}
.balance-frozen {
  --balance-color: #f59e0b;
}
.balance-withdrawn {
  --balance-color: #6366f1;
}

.card-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  margin-bottom: 8px;
}

.card-value {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
  font-family: 'SF Mono', Monaco, monospace;
  letter-spacing: -0.02em;
}

.card-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.tip-alert {
  margin-bottom: 16px;
  text-align: left;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0 12px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.form-tip {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.fee-preview {
  margin-top: 8px;
  text-align: left;
}
</style>
