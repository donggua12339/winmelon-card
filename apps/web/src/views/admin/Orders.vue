<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post } from '@/api/http';

interface OrderItem {
  productName: string;
  quantity: number;
}
interface Order {
  id: string;
  orderNo: string;
  buyerEmail: string;
  totalAmount: string;
  status: 'PENDING' | 'PAID' | 'DELIVERED' | 'EXPIRED' | 'REFUNDED' | 'CLOSED';
  expireAt: string;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  shop: { name: string };
  items: OrderItem[];
}
interface OrderList {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}
interface OrderDetail extends Order {
  stockCards: { id: string; status: string; productId: string }[];
  payments: { id: string; channel: string; amount: string; status: string; paidAt: string | null }[];
}

const loading = ref(false);
const list = ref<Order[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const statusFilter = ref('');
const keyword = ref('');

const detailVisible = ref(false);
const detail = ref<OrderDetail | null>(null);
const detailLoading = ref(false);

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<OrderList>('/admin/orders', {
      params: {
        page: page.value,
        pageSize: pageSize.value,
        status: statusFilter.value || undefined,
        keyword: keyword.value || undefined,
      },
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function openDetail(id: string): Promise<void> {
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    detail.value = await get<OrderDetail>(`/admin/orders/${id}`);
  } finally {
    detailLoading.value = false;
  }
}

async function onRetry(orderId: string): Promise<void> {
  await ElMessageBox.confirm('确定手动补发卡密？仅适用于已支付但未发卡的订单。', '提示', {
    type: 'warning',
  });
  try {
    const result = await post<{ delivered: number }>(`/admin/delivery/${orderId}/retry`);
    ElMessage.success(`补发成功，共 ${result.delivered} 张卡密`);
    if (detail.value?.id === orderId) {
      openDetail(orderId);
    }
    fetchList();
  } catch {
    // 错误已由 http 拦截器提示
  }
}

function statusTag(s: Order['status']): { type: string; text: string } {
  const map: Record<Order['status'], { type: string; text: string }> = {
    PENDING: { type: 'warning', text: '待支付' },
    PAID: { type: 'primary', text: '已支付' },
    DELIVERED: { type: 'success', text: '已发卡' },
    EXPIRED: { type: 'info', text: '已超时' },
    REFUNDED: { type: 'info', text: '已退款' },
    CLOSED: { type: 'info', text: '已关闭' },
  };
  return map[s];
}

function formatTime(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">订单管理</h2>
        <p class="page-desc">查看订单详情、状态与手动补发</p>
      </div>
      <div class="actions">
        <el-input
          v-model="keyword"
          placeholder="订单号/邮箱"
          clearable
          style="width: 220px"
          @clear="fetchList"
          @keyup.enter="fetchList"
        />
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 130px" @change="fetchList">
          <el-option label="待支付" value="PENDING" />
          <el-option label="已支付" value="PAID" />
          <el-option label="已发卡" value="DELIVERED" />
          <el-option label="已超时" value="EXPIRED" />
        </el-select>
        <el-button @click="fetchList">刷新</el-button>
      </div>
    </header>

    <section class="panel">
      <el-table v-loading="loading" :data="list" :border="false" stripe>
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column prop="buyerEmail" label="买家邮箱" min-width="180" />
        <el-table-column label="商品" min-width="200">
          <template #default="{ row }">
            <span v-for="(it, i) in row.items" :key="i">
              {{ it.productName }} x{{ it.quantity }}<span v-if="i < row.items.length - 1">,</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="金额" width="100">
          <template #default="{ row }">
            <span class="amount">¥{{ row.totalAmount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status).type as any">{{ statusTag(row.status).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row.id)">详情</el-button>
            <el-button v-if="row.status === 'PAID'" link type="warning" size="small" @click="onRetry(row.id)">
              手动补发
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        class="pagination"
        @current-change="fetchList"
      />
    </section>

    <el-dialog v-model="detailVisible" title="订单详情" width="640px">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="statusTag(detail.status).type as any">{{ statusTag(detail.status).text }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="买家邮箱">{{ detail.buyerEmail }}</el-descriptions-item>
            <el-descriptions-item label="金额">
              <span class="amount">¥{{ detail.totalAmount }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="超时时间">{{ formatTime(detail.expireAt) }}</el-descriptions-item>
            <el-descriptions-item label="支付时间">{{ formatTime(detail.paidAt) }}</el-descriptions-item>
            <el-descriptions-item label="发卡时间">{{ formatTime(detail.deliveredAt) }}</el-descriptions-item>
          </el-descriptions>

          <h4 class="subsection-title">卡密（{{ detail.stockCards.length }}）</h4>
          <el-table :data="detail.stockCards" border size="small">
            <el-table-column prop="id" label="卡密ID" min-width="200" />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>

          <h4 class="subsection-title">支付记录</h4>
          <el-table :data="detail.payments" border size="small">
            <el-table-column prop="channel" label="通道" width="100" />
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">¥{{ row.amount }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="paidAt" label="支付时间">
              <template #default="{ row }">{{ formatTime(row.paidAt) }}</template>
            </el-table-column>
          </el-table>
        </template>
      </div>
      <template #footer>
        <el-button v-if="detail?.status === 'PAID'" type="warning" @click="onRetry(detail!.id)"> 手动补发 </el-button>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: var(--wm-container-max);
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--wm-space-lg);
  margin-bottom: var(--wm-space-xl);
  flex-wrap: wrap;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--wm-text-primary);
  letter-spacing: -0.01em;
}

.page-desc {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

.actions {
  display: flex;
  gap: var(--wm-space-sm);
}

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.pagination {
  margin-top: var(--wm-space-lg);
  justify-content: flex-end;
  display: flex;
}

.amount {
  font-weight: 600;
  color: var(--wm-text-primary);
  font-variant-numeric: tabular-nums;
}

.subsection-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: var(--wm-space-lg) 0 var(--wm-space-sm);
}
</style>
