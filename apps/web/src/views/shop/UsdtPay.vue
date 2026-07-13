<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get } from '@/api/http';

interface UsdtPaymentInfo {
  orderNo: string;
  walletAddress: string;
  usdtAmount: string;
  expiresAt: string;
  status: string;
  network: string;
}

const route = useRoute();
const router = useRouter();
const orderNo = (route.query.orderNo as string) ?? '';

const info = ref<UsdtPaymentInfo | null>(null);
const loading = ref(true);
const remainingSec = ref(0);
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);
const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null);

const statusText = computed(() => {
  if (!info.value) return '加载中';
  switch (info.value.status) {
    case 'PENDING':
      return remainingSec.value > 0 ? '等待链上确认...' : '已超时';
    case 'SUCCESS':
      return '支付成功';
    case 'EXPIRED':
    case 'FAILED':
      return '支付失败/超时';
    default:
      return info.value.status;
  }
});

const statusType = computed(() => {
  if (!info.value) return 'info';
  switch (info.value.status) {
    case 'PENDING':
      return remainingSec.value > 0 ? 'warning' : 'error';
    case 'SUCCESS':
      return 'success';
    default:
      return 'error';
  }
});

const countdownDisplay = computed(() => {
  const sec = remainingSec.value;
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

async function fetchInfo(): Promise<void> {
  try {
    const data = await get<UsdtPaymentInfo>(`/payment/usdt/info/${orderNo}`);
    info.value = data;
    updateCountdown();
    if (data.status === 'SUCCESS') {
      stopPolling();
      ElMessage.success('支付确认成功');
      setTimeout(() => router.push({ path: '/query', query: { orderNo } }), 2000);
    } else if (data.status === 'EXPIRED' || data.status === 'FAILED') {
      stopPolling();
    }
  } catch {
    /* http 层处理 */
  } finally {
    loading.value = false;
  }
}

function updateCountdown(): void {
  if (!info.value) return;
  const remain = Math.floor((new Date(info.value.expiresAt).getTime() - Date.now()) / 1000);
  remainingSec.value = Math.max(0, remain);
}

function startPolling(): void {
  pollTimer.value = setInterval(fetchInfo, 15000); // 15 秒轮询一次
  countdownTimer.value = setInterval(updateCountdown, 1000);
}

function stopPolling(): void {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value);
    countdownTimer.value = null;
  }
}

function copyAddress(): void {
  if (!info.value) return;
  navigator.clipboard.writeText(info.value.walletAddress).then(() => {
    ElMessage.success('钱包地址已复制');
  });
}

function copyAmount(): void {
  if (!info.value) return;
  navigator.clipboard.writeText(info.value.usdtAmount).then(() => {
    ElMessage.success('金额已复制');
  });
}

onMounted(() => {
  if (!orderNo) {
    ElMessage.error('参数错误');
    loading.value = false;
    return;
  }
  fetchInfo();
  startPolling();
});

onUnmounted(stopPolling);
</script>

<template>
  <div class="usdt-pay-page">
    <div class="glass pay-card">
      <div class="pay-header">
        <div class="pay-icon">₮</div>
        <h1>USDT 支付</h1>
        <p class="pay-subtitle">TRC20 网络 · 链上自动确认</p>
      </div>

      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 24px">
        <template #title>
          请使用支持 TRC20 的钱包转账，转账金额必须与下方显示完全一致（含小数位），否则无法自动匹配。
        </template>
      </el-alert>

      <div v-loading="loading">
        <div class="status-section">
          <el-tag :type="statusType" size="large" effect="dark">
            {{ statusText }}
          </el-tag>
          <div v-if="info?.status === 'PENDING' && remainingSec > 0" class="countdown">
            剩余支付时间：<span class="countdown-num">{{ countdownDisplay }}</span>
          </div>
        </div>

        <div v-if="info" class="info-section">
          <div class="info-row">
            <div class="info-label">收款钱包</div>
            <div class="info-value">
              <code class="address">{{ info.walletAddress }}</code>
              <el-button size="small" @click="copyAddress">复制</el-button>
            </div>
          </div>

          <div class="info-row">
            <div class="info-label">转账金额</div>
            <div class="info-value">
              <span class="amount">{{ info.usdtAmount }}</span>
              <span class="amount-unit">USDT</span>
              <el-button size="small" @click="copyAmount">复制</el-button>
            </div>
          </div>

          <div class="info-row">
            <div class="info-label">网络</div>
            <div class="info-value">
              <span class="network">{{ info.network }}</span>
              <span class="network-hint">（Tron 网络，手续费低）</span>
            </div>
          </div>
        </div>

        <div class="tips-section">
          <h3>支付说明</h3>
          <ol>
            <li>打开您的 USDT 钱包（如 TronLink、TokenPocket、Binance 等）</li>
            <li>选择 <strong>TRC20</strong> 网络转账</li>
            <li>粘贴上方的收款钱包地址</li>
            <li>输入上方的转账金额（必须完全一致，含小数位）</li>
            <li>确认转账后等待 1-3 分钟链上确认</li>
            <li>系统检测到转账后将自动发货</li>
          </ol>
        </div>

        <div class="actions">
          <el-button @click="router.push('/')">返回首页</el-button>
          <el-button type="primary" @click="router.push({ path: '/query', query: { orderNo } })"> 查看订单 </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.usdt-pay-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.pay-card {
  max-width: 560px;
  width: 100%;
  padding: 40px 32px;
}

.pay-header {
  text-align: center;
  margin-bottom: 24px;
}

.pay-icon {
  font-size: 48px;
  margin-bottom: 8px;
  color: #26a17b;
}

.pay-header h1 {
  font-size: 24px;
  margin: 0 0 4px;
}

.pay-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.countdown {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.countdown-num {
  font-family: 'Courier New', monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-warning);
  margin-left: 4px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.address {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  word-break: break-all;
  background: var(--el-fill-color);
  padding: 6px 10px;
  border-radius: 4px;
  flex: 1;
}

.amount {
  font-size: 24px;
  font-weight: 700;
  color: #26a17b;
  font-family: 'Courier New', monospace;
}

.amount-unit {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.network {
  font-weight: 600;
  color: var(--el-color-primary);
}

.network-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.tips-section {
  margin-bottom: 24px;
}

.tips-section h3 {
  font-size: 15px;
  margin: 0 0 12px;
}

.tips-section ol {
  padding-left: 20px;
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.8;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
