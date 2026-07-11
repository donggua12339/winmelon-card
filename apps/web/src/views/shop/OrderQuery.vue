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
  <div class="query">
    <el-card>
      <h2>订单查询</h2>
      <el-form label-width="100px" @submit.prevent="onQuery">
        <el-form-item label="订单号" required>
          <el-input v-model="orderNo" placeholder="下单时返回的订单号" />
        </el-form-item>
        <el-form-item label="联系邮箱" required>
          <el-input v-model="email" placeholder="下单时填写的邮箱" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="onQuery">查询</el-button>
          <RouterLink to="/" class="back">← 返回首页</RouterLink>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="order" style="margin-top: 16px">
      <div class="order-header">
        <h3>订单 {{ order.orderNo }}</h3>
        <el-tag :type="statusLabel(order.status).type as any">{{ statusLabel(order.status).text }}</el-tag>
      </div>

      <el-descriptions :column="2" border style="margin-top: 12px">
        <el-descriptions-item label="总金额">¥{{ order.totalAmount }}</el-descriptions-item>
        <el-descriptions-item label="下单时间">{{ formatTime(order.expireAt) }}</el-descriptions-item>
        <el-descriptions-item label="支付时间">{{ formatTime(order.paidAt) }}</el-descriptions-item>
        <el-descriptions-item label="发卡时间">{{ formatTime(order.deliveredAt) }}</el-descriptions-item>
      </el-descriptions>

      <h4 style="margin-top: 16px">商品明细</h4>
      <el-table :data="order.items" border size="small">
        <el-table-column prop="productName" label="商品" />
        <el-table-column prop="unitPrice" label="单价" width="100">
          <template #default="{ row }">¥{{ row.unitPrice }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="subtotal" label="小计" width="100">
          <template #default="{ row }">¥{{ row.subtotal }}</template>
        </el-table-column>
      </el-table>

      <div v-if="order.cards.length > 0" style="margin-top: 16px">
        <el-alert type="success" :closable="false" show-icon title="卡密已发出，请妥善保管" />
        <div v-for="(card, i) in order.cards" :key="i" class="card-item">
          <div class="card-info">
            <span class="card-name">{{ card.productName }}</span>
            <code class="card-content">{{ card.content }}</code>
          </div>
          <el-button link type="primary" @click="copyCard(card.content, i)">
            {{ copiedIndex === i ? '已复制' : '复制' }}
          </el-button>
        </div>
      </div>

      <el-alert
        v-else-if="order.status === 'PENDING'"
        type="warning"
        :closable="false"
        show-icon
        title="订单待支付，请尽快完成支付"
        style="margin-top: 16px"
      />
    </el-card>
  </div>
</template>

<style scoped>
.query {
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
}
.back {
  margin-left: 12px;
  color: #606266;
  text-decoration: none;
}
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-top: 8px;
  background: #f9fafc;
}
.card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-name {
  color: #606266;
  font-size: 13px;
}
.card-content {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  word-break: break-all;
}
</style>
