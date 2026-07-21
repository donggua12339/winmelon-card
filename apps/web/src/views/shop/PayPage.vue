<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: string;
}
interface OrderSummary {
  orderId: string;
  orderNo: string;
  totalAmount: string;
  status: string;
  expireAt: string;
  createdAt: string;
  shopName: string;
  items: OrderItem[];
}

const route = useRoute();
const router = useRouter();
const orderNo = (route.query.orderNo as string) ?? '';

const order = ref<OrderSummary | null>(null);
const loading = ref(true);
const submitting = ref(false);
const channel = ref<'wechat' | 'usdt' | 'mock'>('wechat');
const remainingSec = ref(0);
const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null);

const isPending = computed(() => order.value?.status === 'PENDING');
const isPaid = computed(() => order.value?.status === 'PAID' || order.value?.status === 'DELIVERED');
const isExpired = computed(() => order.value?.status === 'EXPIRED' || order.value?.status === 'CLOSED');

const countdownDisplay = computed(() => {
  const sec = remainingSec.value;
  if (sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

function updateCountdown(): void {
  if (!order.value) return;
  const remain = Math.floor((new Date(order.value.expireAt).getTime() - Date.now()) / 1000);
  remainingSec.value = Math.max(0, remain);
  if (remain <= 0 && countdownTimer.value) {
    clearInterval(countdownTimer.value);
    countdownTimer.value = null;
  }
}

async function fetchOrder(): Promise<void> {
  if (!orderNo) {
    ElMessage.error('缺少订单号');
    loading.value = false;
    return;
  }
  try {
    order.value = await get<OrderSummary>(`/payment/order-summary/${orderNo}`);
    if (isPending.value) {
      updateCountdown();
      countdownTimer.value = setInterval(updateCountdown, 1000);
    }
  } catch {
    /* http 层处理 */
  } finally {
    loading.value = false;
  }
}

async function onPay(): Promise<void> {
  if (!order.value) return;
  submitting.value = true;
  try {
    const pay = await post<{ paymentUrl: string; orderNo: string }>('/payments', {
      orderId: order.value.orderId,
      channel: channel.value,
    });
    window.location.href = pay.paymentUrl;
  } catch (err) {
    console.error(err);
  } finally {
    submitting.value = false;
  }
}

onMounted(fetchOrder);
onUnmounted(() => {
  if (countdownTimer.value) clearInterval(countdownTimer.value);
});
</script>

<template>
  <div class="pay-page">
    <div v-loading="loading" class="glass pay-card">
      <div class="pay-header">
        <h1>订单支付</h1>
        <p v-if="order" class="shop-name">{{ order.shopName }}</p>
      </div>

      <!-- 订单信息 -->
      <div v-if="order" class="order-info">
        <div class="order-row">
          <span class="label">订单号</span>
          <code class="value">{{ order.orderNo }}</code>
        </div>
        <div v-for="(item, i) in order.items" :key="i" class="order-row item-row">
          <span class="item-name">{{ item.productName }}</span>
          <span class="item-qty">×{{ item.quantity }}</span>
          <span class="item-price">¥{{ item.unitPrice }}</span>
        </div>
        <div class="order-row total-row">
          <span class="label">应付金额</span>
          <span class="total-amount">¥{{ order.totalAmount }}</span>
        </div>
      </div>

      <!-- 待支付：选支付方式 -->
      <div v-if="order && isPending" class="pay-section">
        <div v-if="remainingSec > 0" class="countdown">
          剩余支付时间：<span class="countdown-num">{{ countdownDisplay }}</span>
        </div>
        <div v-else class="expired-hint">订单已超时，请重新下单</div>

        <div v-if="remainingSec > 0" class="channel-select">
          <label class="section-label">选择支付方式</label>
          <el-radio-group v-model="channel" size="large">
            <el-radio value="wechat">
              <span class="channel-label">💚 微信支付</span>
            </el-radio>
            <el-radio value="usdt">
              <span class="channel-label">₮ USDT（TRC20）</span>
            </el-radio>
            <el-radio value="mock">
              <span class="channel-label">🧪 模拟支付（测试）</span>
            </el-radio>
          </el-radio-group>
        </div>

        <el-button
          v-if="remainingSec > 0"
          type="primary"
          size="large"
          :loading="submitting"
          class="pay-btn"
          @click="onPay"
        >
          立即支付 ¥{{ order.totalAmount }}
        </el-button>
      </div>

      <!-- 已支付 -->
      <div v-if="order && isPaid" class="status-section success">
        <div class="status-icon">✅</div>
        <h2>支付成功</h2>
        <p>您的订单已支付，商品将自动发放到您的邮箱。</p>
        <el-button type="primary" @click="router.push({ path: '/query', query: { orderNo } })">
          查看订单详情
        </el-button>
      </div>

      <!-- 已过期 -->
      <div v-if="order && isExpired" class="status-section expired">
        <div class="status-icon">⏰</div>
        <h2>订单已关闭</h2>
        <p>该订单已超时或关闭，请返回店铺重新下单。</p>
        <el-button type="primary" @click="router.push('/')">返回首页</el-button>
      </div>

      <!-- 加载失败 / 不存在 -->
      <div v-if="!loading && !order" class="status-section error">
        <div class="status-icon">❌</div>
        <h2>订单不存在</h2>
        <p>未找到该订单，请检查链接是否正确。</p>
        <el-button type="primary" @click="router.push('/')">返回首页</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pay-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.pay-card {
  max-width: 520px;
  width: 100%;
  padding: 40px 32px;
}

.pay-header {
  text-align: center;
  margin-bottom: 24px;
}

.pay-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
}

.shop-name {
  font-size: 14px;
  color: var(--wm-text-secondary);
  margin: 0;
}

.order-info {
  background: var(--wm-bg-hover);
  border-radius: var(--wm-radius-md);
  padding: 16px 20px;
  margin-bottom: 24px;
}

.order-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.order-row .label {
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.order-row .value {
  font-size: 13px;
  font-family: var(--wm-font-mono);
  color: var(--wm-text-primary);
}

.item-row {
  padding: 4px 0;
  font-size: 14px;
}

.item-name {
  flex: 1;
  color: var(--wm-text-primary);
}

.item-qty {
  color: var(--wm-text-tertiary);
  margin: 0 12px;
}

.item-price {
  color: var(--wm-text-primary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.total-row {
  border-top: 1px solid var(--wm-border-default);
  margin-top: 8px;
  padding-top: 12px;
}

.total-amount {
  font-size: 22px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  font-variant-numeric: tabular-nums;
}

.pay-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.countdown {
  font-size: 14px;
  color: var(--wm-text-secondary);
}

.countdown-num {
  font-family: var(--wm-font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--wm-accent-warning);
}

.expired-hint {
  color: var(--wm-accent-danger);
  font-weight: 600;
}

.channel-select {
  width: 100%;
}

.section-label {
  display: block;
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.channel-label {
  font-size: 15px;
}

.pay-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  margin-top: 8px;
}

.status-section {
  text-align: center;
  padding: 24px 0;
}

.status-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.status-section h2 {
  font-size: 20px;
  margin: 0 0 8px;
}

.status-section p {
  font-size: 14px;
  color: var(--wm-text-secondary);
  margin: 0 0 20px;
}
</style>
