<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import QRCode from 'qrcode';
import { get } from '@/api/http';

const route = useRoute();
const router = useRouter();
const orderNo = (route.query.orderNo as string) ?? '';
const codeUrl = decodeURIComponent((route.query.code as string) ?? '');

const qrCodeUrl = ref('');
const loading = ref(true);
const status = ref<string>('PENDING');
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);

const statusText = computed(() => {
  switch (status.value) {
    case 'PENDING':
      return '等待扫码支付...';
    case 'PAID':
    case 'DELIVERED':
      return '支付成功';
    case 'EXPIRED':
    case 'CLOSED':
      return '订单已关闭/超时';
    case 'REFUNDED':
      return '已退款';
    default:
      return status.value;
  }
});

const statusType = computed<'primary' | 'success' | 'warning' | 'info' | 'danger'>(() => {
  switch (status.value) {
    case 'PENDING':
      return 'warning';
    case 'PAID':
    case 'DELIVERED':
      return 'success';
    default:
      return 'danger';
  }
});

async function renderQr(): Promise<void> {
  if (!codeUrl) return;
  qrCodeUrl.value = await QRCode.toDataURL(codeUrl, {
    width: 240,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

async function fetchStatus(): Promise<void> {
  try {
    const data = await get<{ orderNo: string; status: string }>(`/payment/wechat/status/${orderNo}`);
    status.value = data.status;
    if (data.status === 'PAID' || data.status === 'DELIVERED') {
      stopPolling();
      ElMessage.success('支付成功');
      setTimeout(() => router.push({ path: '/query', query: { orderNo } }), 1500);
    } else if (data.status === 'EXPIRED' || data.status === 'CLOSED' || data.status === 'REFUNDED') {
      stopPolling();
    }
  } catch {
    /* http 层处理 */
  } finally {
    loading.value = false;
  }
}

function startPolling(): void {
  pollTimer.value = setInterval(fetchStatus, 3000);
}

function stopPolling(): void {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
}

onMounted(() => {
  if (!orderNo || !codeUrl) {
    ElMessage.error('支付参数错误');
    loading.value = false;
    return;
  }
  renderQr();
  fetchStatus();
  startPolling();
});

onUnmounted(stopPolling);
</script>

<template>
  <div class="wechat-pay-page">
    <div class="glass pay-card">
      <div class="pay-header">
        <div class="pay-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#07c160">
            <path
              d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.127 6.127 0 0 1-.253-1.736c0-3.54 3.258-6.413 7.272-6.413.242 0 .478.015.712.035C16.32 4.618 12.84 2.188 8.691 2.188zm-2.87 4.401a1.03 1.03 0 1 1 0 2.062 1.03 1.03 0 0 1 0-2.062zm5.742 0a1.03 1.03 0 1 1 0 2.062 1.03 1.03 0 0 1 0-2.062zm4.958 3.843c-3.511 0-6.357 2.51-6.357 5.604 0 3.094 2.846 5.604 6.357 5.604.69 0 1.357-.098 1.983-.28a.72.72 0 0 1 .597.082l1.588.929a.272.272 0 0 0 .14.045.244.244 0 0 0 .241-.245c0-.06-.024-.12-.04-.178l-.326-1.233a.49.49 0 0 1 .177-.554C21.926 19.062 22.878 17.39 22.878 15.036c0-3.094-2.846-5.604-6.357-5.604zm-2.27 3.27a.858.858 0 1 1 0 1.716.858.858 0 0 1 0-1.716zm4.542 0a.858.858 0 1 1 0 1.716.858.858 0 0 1 0-1.716z"
            />
          </svg>
        </div>
        <h1>微信支付</h1>
        <p class="pay-subtitle">请使用微信扫一扫完成付款</p>
      </div>

      <!-- 二维码 -->
      <div v-if="qrCodeUrl" class="qr-section">
        <img :src="qrCodeUrl" alt="微信支付二维码" class="qr-img" />
        <div class="qr-hint">打开微信 → 扫一扫 → 扫描上方二维码</div>
      </div>
      <div v-else class="qr-section qr-loading">二维码生成中...</div>

      <div v-loading="loading">
        <div class="status-section">
          <el-tag :type="statusType" size="large" effect="dark">{{ statusText }}</el-tag>
        </div>

        <div class="info-section">
          <div class="info-row">
            <div class="info-label">订单号</div>
            <div class="info-value">
              <code class="order-no">{{ orderNo }}</code>
            </div>
          </div>
        </div>

        <div class="tips-section">
          <h3>支付说明</h3>
          <ol>
            <li>打开微信，点击右上角「+」→「扫一扫」</li>
            <li>扫描上方二维码</li>
            <li>在微信内确认付款金额并完成支付</li>
            <li>支付成功后系统将自动发货，无需手动操作</li>
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
.wechat-pay-page {
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
  margin-bottom: 8px;
}

.pay-header h1 {
  font-size: 24px;
  margin: 0 0 4px;
}

.pay-subtitle {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin: 0;
}

.qr-section {
  text-align: center;
  margin-bottom: 24px;
  padding: 16px;
  background: #ffffff;
  border-radius: 8px;
}

.qr-loading {
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

.qr-img {
  width: 220px;
  height: 220px;
  display: block;
  margin: 0 auto 8px;
}

.qr-hint {
  font-size: 12px;
  color: var(--wm-text-secondary);
}

.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--wm-bg-hover);
  border-radius: 8px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--wm-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.order-no {
  font-family: var(--wm-font-mono);
  font-size: 13px;
  word-break: break-all;
  background: var(--wm-bg-card);
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--wm-border-default);
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
  color: var(--wm-text-secondary);
  line-height: 1.8;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
