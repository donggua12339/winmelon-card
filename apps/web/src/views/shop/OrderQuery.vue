<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';

interface OrderItem {
  productName: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}
interface OrderCard {
  productName: string;
  content: string;
}
interface OrderResult {
  id: string;
  orderNo: string;
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED' | 'CLOSED';
  totalAmount: string;
  expireAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  cards: OrderCard[];
}

const orderNo = ref('');
const email = ref('');
const loading = ref(false);
const order = ref<OrderResult | null>(null);
const copiedIndex = ref<number | null>(null);

async function onQuery(): Promise<void> {
  if (!orderNo.value || !email.value) {
    ElMessage.warning('请填写订单号和邮箱');
    return;
  }
  loading.value = true;
  try {
    order.value = await post<OrderResult>('/orders/query', {
      orderNo: orderNo.value.trim(),
      buyerEmail: email.value.trim(),
    });
  } catch {
    order.value = null;
  } finally {
    loading.value = false;
  }
}

async function copyCard(content: string, index: number): Promise<void> {
  await navigator.clipboard.writeText(content);
  copiedIndex.value = index;
  ElMessage.success('已复制');
  setTimeout(() => {
    copiedIndex.value = null;
  }, 1500);
}

function statusLabel(s: OrderResult['status']): { type: string; text: string } {
  const map: Record<OrderResult['status'], { type: string; text: string }> = {
    PENDING: { type: 'warning', text: '待支付' },
    PAID: { type: 'primary', text: '已支付，发卡中' },
    DELIVERED: { type: 'success', text: '已发卡' },
    EXPIRED: { type: 'info', text: '已超时关闭' },
    REFUNDED: { type: 'info', text: '已退款' },
    CLOSED: { type: 'info', text: '已关闭' },
  };
  return map[s];
}

function formatTime(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}
</script>

<template>
  <div class="query-page">
    <div class="query-container">
      <RouterLink to="/" class="back">← 返回首页</RouterLink>

      <!-- 查询表单 -->
      <div class="glass query-card">
        <h1 class="title">
          <span class="text-gradient">订单查询</span>
        </h1>
        <p class="subtitle">输入订单号和邮箱，查看您的卡密</p>

        <form class="query-form" @submit.prevent="onQuery">
          <div class="form-row">
            <label>订单号</label>
            <el-input v-model="orderNo" placeholder="下单时返回的订单号" size="large" />
          </div>
          <div class="form-row">
            <label>联系邮箱</label>
            <el-input v-model="email" placeholder="下单时填写的邮箱" size="large" />
          </div>
          <el-button type="primary" size="large" :loading="loading" native-type="submit" class="submit-btn">
            查询订单
          </el-button>
        </form>
      </div>

      <!-- 查询结果 -->
      <div v-if="order" class="glass result-card">
        <div class="result-header">
          <div>
            <div class="order-no-label">订单号</div>
            <div class="order-no">{{ order.orderNo }}</div>
          </div>
          <el-tag :type="statusLabel(order.status).type as any" size="large" effect="dark">
            {{ statusLabel(order.status).text }}
          </el-tag>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">总金额</span>
            <span class="info-value price-neon">¥{{ order.totalAmount }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">下单时间</span>
            <span class="info-value">{{ formatTime(order.expireAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">支付时间</span>
            <span class="info-value">{{ formatTime(order.paidAt) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">发卡时间</span>
            <span class="info-value">{{ formatTime(order.deliveredAt) }}</span>
          </div>
        </div>

        <h3 class="section-title">商品明细</h3>
        <div class="items-list">
          <div v-for="(it, i) in order.items" :key="i" class="item-row">
            <span class="item-name">{{ it.productName }}</span>
            <span class="item-qty">x{{ it.quantity }}</span>
            <span class="item-subtotal">¥{{ it.subtotal }}</span>
          </div>
        </div>

        <!-- 卡密展示 -->
        <div v-if="order.cards.length > 0" class="cards-section">
          <el-alert type="success" :closable="false" show-icon title="卡密已发出，请妥善保管" />
          <div v-for="(card, i) in order.cards" :key="i" class="card-item">
            <div class="card-info">
              <span class="card-name">{{ card.productName }}</span>
              <code class="card-content">{{ card.content }}</code>
            </div>
            <button class="copy-btn" @click="copyCard(card.content, i)">
              {{ copiedIndex === i ? '已复制' : '复制' }}
            </button>
          </div>
        </div>

        <el-alert
          v-else-if="order.status === 'PENDING'"
          type="warning"
          :closable="false"
          show-icon
          title="订单待支付，请尽快完成支付"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.query-page {
  min-height: 100vh;
  padding: 32px 16px;
}

.query-container {
  max-width: 680px;
  margin: 0 auto;
}

.back {
  display: inline-block;
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 16px;
  transition: color 0.3s ease;
}

.back:hover {
  color: var(--wm-accent-cyan);
}

/* 查询卡 */
.query-card {
  padding: 40px 32px;
  margin-bottom: 24px;
  animation: fade-in-up 0.6s ease-out;
}

.title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 8px;
  text-align: center;
}

.subtitle {
  color: var(--wm-text-secondary);
  font-size: 14px;
  text-align: center;
  margin: 0 0 32px;
}

.query-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  font-weight: 500;
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
}

/* 结果卡 */
.result-card {
  padding: 28px;
  animation: fade-in-up 0.6s ease-out;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--wm-border-glass);
  margin-bottom: 20px;
}

.order-no-label {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-bottom: 4px;
}

.order-no {
  font-family: var(--wm-font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--wm-text-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--wm-text-tertiary);
}

.info-value {
  font-size: 14px;
  color: var(--wm-text-primary);
}

.section-title {
  font-size: 14px;
  color: var(--wm-text-secondary);
  margin: 0 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--wm-glass-bg);
  border-radius: var(--wm-radius-md);
}

.item-name {
  flex: 1;
  font-size: 14px;
}

.item-qty {
  color: var(--wm-text-tertiary);
  font-size: 13px;
  margin: 0 16px;
}

.item-subtotal {
  font-weight: 600;
  color: var(--wm-text-primary);
}

/* 卡密 */
.cards-section {
  margin-top: 24px;
}

.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-top: 12px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(6, 182, 212, 0.08));
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-md);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.card-name {
  color: var(--wm-text-secondary);
  font-size: 12px;
}

.card-content {
  font-family: var(--wm-font-mono);
  font-size: 14px;
  color: var(--wm-text-primary);
  word-break: break-all;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px 10px;
  border-radius: var(--wm-radius-sm);
}

.copy-btn {
  padding: 6px 16px;
  background: var(--wm-gradient-primary);
  color: white;
  border: none;
  border-radius: var(--wm-radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-left: 12px;
  flex-shrink: 0;
}

.copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}
</style>
