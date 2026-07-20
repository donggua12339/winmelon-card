<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, post } from '@/api/http';

interface Ticket {
  id: string;
  ticketNo: string;
  buyerEmail: string;
  category: string;
  subject: string;
  status: string;
  lastRepliedAt?: string | null;
  lastRepliedByRole?: string | null;
  autoRefundAt?: string | null;
  createdAt: string;
  shop?: { name: string };
  order?: { orderNo: string } | null;
}
interface TicketDetail extends Ticket {
  description: string;
  messages: {
    id: string;
    senderRole: string;
    senderName?: string | null;
    content: string;
    isInternal: boolean;
    createdAt: string;
  }[];
  order: { orderNo: string; totalAmount: string; status: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: '待响应',
  BUYER_REPLIED: '买家已回',
  MERCHANT_REPLIED: '商户已回',
  PLATFORM_REPLIED: '平台已回',
  RESOLVED: '已解决',
  AUTO_REFUNDED: '自动退款',
  CLOSED: '已关闭',
};
const STATUS_TYPES: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  OPEN: 'danger',
  BUYER_REPLIED: 'warning',
  MERCHANT_REPLIED: 'success',
  PLATFORM_REPLIED: 'info',
  RESOLVED: 'info',
  AUTO_REFUNDED: 'danger',
  CLOSED: 'info',
};
const ROLE_LABELS: Record<string, string> = {
  buyer: '买家',
  merchant: '商户',
  platform: '平台',
};

const list = ref<Ticket[]>([]);
const loading = ref(false);
const statusFilter = ref('');
const detail = ref<TicketDetail | null>(null);
const detailVisible = ref(false);
const replyText = ref('');

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const res = await get<{ items: Ticket[]; total: number }>('/merchant/tickets', {
      params: { status: statusFilter.value || undefined, page: 1, pageSize: 50 },
    });
    list.value = res.items;
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: Ticket): Promise<void> {
  try {
    detail.value = await get<TicketDetail>(`/merchant/tickets/${row.id}`);
    detailVisible.value = true;
    replyText.value = '';
  } catch {
    /* http 层已提示 */
  }
}

async function reply(): Promise<void> {
  if (!detail.value || !replyText.value.trim()) return;
  try {
    await post(`/merchant/tickets/${detail.value.id}/reply`, { content: replyText.value });
    ElMessage.success('已回复');
    replyText.value = '';
    detail.value = await get<TicketDetail>(`/merchant/tickets/${detail.value.id}`);
    fetchList();
  } catch {
    /* http 层已提示 */
  }
}

onMounted(fetchList);
</script>

<template>
  <div v-loading="loading" class="tickets-page">
    <div class="page-header">
      <h2>工单管理</h2>
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="fetchList">
        <el-option v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
    </div>

    <el-table :data="list" border>
      <el-table-column prop="ticketNo" label="工单号" width="190" />
      <el-table-column prop="subject" label="主题" min-width="200" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="STATUS_TYPES[row.status] ?? 'info'" size="small">
            {{ STATUS_LABELS[row.status] ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="buyerEmail" label="买家邮箱" width="200" show-overflow-tooltip />
      <el-table-column label="最后回复" width="170">
        <template #default="{ row }">
          <span v-if="row.lastRepliedAt">
            {{ ROLE_LABELS[row.lastRepliedByRole ?? ''] ?? row.lastRepliedByRole }}
            · {{ new Date(row.lastRepliedAt).toLocaleString('zh-CN') }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row as Ticket)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="detailVisible" title="工单详情" size="600px">
      <template v-if="detail">
        <div class="detail-header">
          <h3>{{ detail.subject }}</h3>
          <el-tag :type="STATUS_TYPES[detail.status] ?? 'info'" size="small">
            {{ STATUS_LABELS[detail.status] ?? detail.status }}
          </el-tag>
        </div>
        <div class="detail-meta">
          <div>工单号：{{ detail.ticketNo }}</div>
          <div>买家：{{ detail.buyerEmail }}</div>
          <div v-if="detail.order">
            订单：{{ detail.order.orderNo }} · ¥{{ Number(detail.order.totalAmount).toFixed(2) }}
          </div>
          <div v-if="detail.autoRefundAt" style="color: #ef4444">
            ⏰ 自动退款时间：{{ new Date(detail.autoRefundAt).toLocaleString('zh-CN') }}
          </div>
        </div>

        <div class="message-list">
          <div
            v-for="msg in detail.messages"
            :key="msg.id"
            :class="['message-item', `msg-${msg.senderRole}`, { 'msg-internal': msg.isInternal }]"
          >
            <div class="msg-sender">
              {{ ROLE_LABELS[msg.senderRole] ?? msg.senderRole }}
              <span v-if="msg.senderName">({{ msg.senderName }})</span>
              <el-tag v-if="msg.isInternal" size="small" type="warning">内部</el-tag>
            </div>
            <div class="msg-content">{{ msg.content }}</div>
            <div class="msg-time">{{ new Date(msg.createdAt).toLocaleString('zh-CN') }}</div>
          </div>
        </div>

        <div class="reply-area">
          <el-input v-model="replyText" type="textarea" :rows="3" placeholder="输入回复内容..." />
          <el-button type="primary" :disabled="!replyText.trim()" style="margin-top: 8px" @click="reply">
            发送回复
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.tickets-page {
  padding: 16px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0;
  font-size: 18px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.detail-header h3 {
  margin: 0;
  font-size: 16px;
}
.detail-meta {
  font-size: 13px;
  color: var(--wm-text-secondary);
  background: var(--wm-bg-hover);
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  line-height: 1.8;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.message-item {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--wm-border-default);
}
.msg-merchant {
  background: #dcfce7;
}
.msg-platform {
  background: #fef3c7;
}
.msg-internal {
  border: 1px dashed var(--wm-accent-warning);
}
.msg-sender {
  font-size: 12px;
  font-weight: 600;
  color: var(--wm-text-secondary);
  margin-bottom: 4px;
}
.msg-content {
  font-size: 14px;
  color: var(--wm-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-time {
  font-size: 11px;
  color: var(--wm-text-tertiary);
  margin-top: 4px;
}
.reply-area {
  border-top: 1px solid var(--wm-border-default);
  padding-top: 12px;
}
</style>
