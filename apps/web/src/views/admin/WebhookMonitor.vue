<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { get } from '@/api/http';

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
  createdAt: string;
  deliveredAt: string | null;
  items: OrderItem[];
}

interface OrderList {
  items: Order[];
  total: number;
}

const loading = ref(false);
const list = ref<Order[]>([]);
const total = ref(0);

// SeekAll 商品关键词（用于前端过滤，因为后端列表不直接暴露 seekallTier）
const SEEKALL_KEYWORDS = ['seekall', 'SeekAll', 'SEEKALL'];

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    // 拉最近 200 条订单，前端过滤 SeekAll 商品
    const data = await get<OrderList>('/admin/orders', {
      params: { page: 1, pageSize: 200 },
    });
    list.value = data.items.filter((o) =>
      o.items.some((it) => SEEKALL_KEYWORDS.some((k) => it.productName.includes(k))),
    );
    total.value = list.value.length;
  } finally {
    loading.value = false;
  }
}

const stats = computed(() => {
  const totalOrders = list.value.length;
  const delivered = list.value.filter((o) => o.status === 'DELIVERED').length;
  const paid = list.value.filter((o) => o.status === 'PAID').length;
  const pending = list.value.filter((o) => o.status === 'PENDING').length;
  const failed = totalOrders - delivered - paid - pending;
  const successRate = totalOrders > 0 ? ((delivered / totalOrders) * 100).toFixed(1) : '0.0';
  return { totalOrders, delivered, paid, pending, failed, successRate };
});

function formatTime(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleString();
}

function statusTag(s: Order['status']): { type: string; text: string; webhookStatus: string } {
  const map: Record<Order['status'], { type: string; text: string; webhookStatus: string }> = {
    PENDING: { type: 'warning', text: '待支付', webhookStatus: '未触发' },
    PAID: { type: 'primary', text: '已支付', webhookStatus: '待发卡' },
    DELIVERED: { type: 'success', text: '已发卡', webhookStatus: '成功' },
    EXPIRED: { type: 'info', text: '已超时', webhookStatus: '未触发' },
    REFUNDED: { type: 'info', text: '已退款', webhookStatus: '-' },
    CLOSED: { type: 'info', text: '已关闭', webhookStatus: '-' },
  };
  return map[s];
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">Webhook 监控</h2>
        <p class="page-desc">SeekAll webhook 触发情况（基于订单状态推断）</p>
      </div>
      <div class="actions">
        <el-button @click="fetchList">刷新</el-button>
      </div>
    </header>

    <!-- 配置说明 -->
    <section class="panel config-panel">
      <h3 class="panel-title">配置说明</h3>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="Webhook URL">SEEKALL_WEBHOOK_URL（环境变量）</el-descriptions-item>
        <el-descriptions-item label="签名密钥">WM_WEBHOOK_SECRET（环境变量）</el-descriptions-item>
        <el-descriptions-item label="触发时机">订单支付成功（OrderPaidEvent）</el-descriptions-item>
        <el-descriptions-item label="超时">5 秒</el-descriptions-item>
        <el-descriptions-item label="失败处理">只记日志，不阻塞订单</el-descriptions-item>
        <el-descriptions-item label="签名算法">HMAC-SHA256(secret, "orderNo|tier|amount")</el-descriptions-item>
      </el-descriptions>
      <div class="config-tip">
        配置变更需修改服务器 <code>.env.prod</code> 后重启 API 容器。Webhook 触发失败不会自动重试，如需补发请联系开发。
      </div>
    </section>

    <!-- 统计 -->
    <div class="stats-grid">
      <div class="stat-card stat-primary">
        <div class="stat-label">SeekAll 订单总数</div>
        <div class="stat-value">{{ stats.totalOrders }}</div>
        <div class="stat-sub">最近 200 条订单内</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-label">已发卡（webhook 成功）</div>
        <div class="stat-value">{{ stats.delivered }}</div>
        <div class="stat-sub">成功率 {{ stats.successRate }}%</div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-label">待支付 / 待发卡</div>
        <div class="stat-value">{{ stats.pending }} / {{ stats.paid }}</div>
        <div class="stat-sub">PENDING / PAID 状态</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-label">异常订单</div>
        <div class="stat-value">{{ stats.failed }}</div>
        <div class="stat-sub">超时/退款/关闭</div>
      </div>
    </div>

    <!-- 订单列表 -->
    <section class="panel">
      <h3 class="panel-title">SeekAll 订单列表（{{ list.length }}）</h3>
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
        <el-table-column prop="totalAmount" label="金额" width="100" align="right">
          <template #default="{ row }">
            <span class="amount">¥{{ row.totalAmount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status).type as any">{{ statusTag(row.status).text }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Webhook" width="100">
          <template #default="{ row }">
            <el-tag
              :type="
                statusTag(row.status).webhookStatus === '成功'
                  ? 'success'
                  : statusTag(row.status).webhookStatus === '未触发' || statusTag(row.status).webhookStatus === '-'
                    ? 'info'
                    : 'warning'
              "
              size="small"
            >
              {{ statusTag(row.status).webhookStatus }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="下单时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="deliveredAt" label="发卡时间" width="170">
          <template #default="{ row }">{{ formatTime(row.deliveredAt) }}</template>
        </el-table-column>
      </el-table>
    </section>
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
  margin-bottom: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.config-panel {
  margin-bottom: var(--wm-space-xl);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 var(--wm-space-md);
  letter-spacing: -0.005em;
}

.config-tip {
  margin-top: var(--wm-space-md);
  padding: var(--wm-space-md);
  background: var(--wm-bg-hover);
  border-radius: var(--wm-radius-sm);
  font-size: 13px;
  color: var(--wm-text-secondary);
  line-height: 1.5;
}

.config-tip code {
  font-family: var(--wm-font-mono);
  font-size: 12px;
  background: var(--wm-bg-card);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid var(--wm-border-default);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--wm-space-md);
  margin-bottom: var(--wm-space-xl);
}

.stat-card {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-xl);
  box-shadow: var(--wm-shadow-sm);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--card-color);
}

.stat-primary {
  --card-color: var(--wm-accent-primary);
}
.stat-success {
  --card-color: var(--wm-accent-success);
}
.stat-warning {
  --card-color: var(--wm-accent-warning);
}
.stat-danger {
  --card-color: var(--wm-accent-danger);
}

.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--wm-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.stat-sub {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  margin-top: 6px;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--wm-text-primary);
}
</style>
