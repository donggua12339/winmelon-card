<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';

const route = useRoute();
const router = useRouter();
const orderNo = (route.query.orderNo as string) ?? '';
const amount = (route.query.amount as string) ?? '';

const paying = ref(false);
const paid = ref(false);

async function onPay(): Promise<void> {
  if (!orderNo) {
    ElMessage.error('订单号缺失');
    return;
  }
  paying.value = true;
  try {
    await post('/payment/mock-pay', { orderNo });
    paid.value = true;
    ElMessage.success('支付成功，2 秒后跳转订单查询页');
    setTimeout(() => {
      router.push({ path: '/query', query: { orderNo } });
    }, 2000);
  } finally {
    paying.value = false;
  }
}

onMounted(() => {
  if (!orderNo) {
    ElMessage.error('参数错误');
  }
});
</script>

<template>
  <div class="mock-pay-page">
    <div class="glass pay-card">
      <div class="pay-header">
        <div class="pay-icon">💳</div>
        <h1>模拟支付</h1>
        <p class="pay-subtitle">开发测试通道</p>
      </div>

      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="此页面仅用于本地开发与测试，生产环境请关闭 mock 通道"
        style="margin-bottom: 24px"
      />

      <div class="amount-section">
        <div class="amount-label">应付金额</div>
        <div class="amount">¥{{ amount }}</div>
      </div>

      <div class="order-section">
        <div class="order-label">订单号</div>
        <div class="order-value">{{ orderNo }}</div>
      </div>

      <button v-if="!paid" class="pay-btn" :disabled="paying" @click="onPay">
        <span v-if="!paying">确认支付 ¥{{ amount }}</span>
        <span v-else>支付中...</span>
      </button>

      <div v-else class="paid-result">
        <div class="paid-icon">✓</div>
        <div class="paid-text">支付成功</div>
        <div class="paid-tip">即将跳转到订单查询页...</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mock-pay-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.pay-card {
  width: 100%;
  max-width: 440px;
  padding: 40px 32px;
  animation: fade-in-up 0.6s ease-out;
}

.pay-header {
  text-align: center;
  margin-bottom: 24px;
}

.pay-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.pay-header h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--wm-text-primary);
}

.pay-subtitle {
  color: var(--wm-text-tertiary);
  font-size: 13px;
  margin: 0;
}

.amount-section {
  text-align: center;
  padding: 32px 0;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.08));
  border-radius: var(--wm-radius-lg);
  border: 1px solid var(--wm-border-glass);
}

.amount-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 8px;
}

.amount {
  font-size: 48px;
  font-weight: 800;
  color: var(--wm-accent-pink);
  text-shadow: 0 0 24px rgba(244, 114, 182, 0.4);
  line-height: 1;
}

.order-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--wm-glass-bg);
  border-radius: var(--wm-radius-md);
  margin-bottom: 24px;
}

.order-label {
  color: var(--wm-text-secondary);
  font-size: 13px;
}

.order-value {
  font-family: var(--wm-font-mono);
  font-size: 14px;
  color: var(--wm-text-primary);
  font-weight: 600;
}

.pay-btn {
  width: 100%;
  height: 52px;
  background: var(--wm-gradient-primary);
  color: white;
  border: none;
  border-radius: var(--wm-radius-md);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
}

.pay-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(124, 58, 237, 0.6);
}

.pay-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.paid-result {
  text-align: center;
  padding: 24px 0;
}

.paid-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--wm-gradient-primary);
  color: white;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 0 32px rgba(52, 211, 153, 0.5);
  animation: glow-pulse 2s ease-in-out infinite;
}

.paid-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--wm-accent-green);
  margin-bottom: 8px;
}

.paid-tip {
  color: var(--wm-text-tertiary);
  font-size: 13px;
}
</style>
