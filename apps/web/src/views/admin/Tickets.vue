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
  shop?: { name: string; merchant?: { name: string } };
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
const isInternal = ref(false);

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const res = await get<{ items: Ticket[]; total: number }>('/admin/tickets', {
      params: { status: statusFilter.value || undefined, page: 1, pageSize: 50 },
    });
    list.value = res.items;
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: Ticket): Promise<void> {
  try {
    detail.value = await get<TicketDetail>(`/admin/tickets/${row.id}`);
    detailVisible.value = true;
    replyText.value = '';
    isInternal.value = false;
  } catch {
    /* http 层已提示 */
  }
}

async function reply(): Promise<void> {
  if (!detail.value || !replyText.value.trim()) return;
  try {
    await post(`/admin/tickets/${detail.value.id}/reply`, {
      content: replyText.value,
      isInternal: isInternal.value,
    });
    ElMessage.success('已回复');
    replyText.value = '';
    isInternal.value = false;
    detail.value = await get<TicketDetail>(`/admin/tickets/${detail.value.id}`);
    fetchList();
  } catch {
    /* http 层已提示 */
  }
}

async function resolve(): Promise<void> {
  if (!detail.value) return;
  try {
    await post(`/admin/tickets/${detail.value.id}/resolve`);
    ElMessage.success('已标记为已解决');
    detailVisible.value = false;
    fetchList();
  } catch {
    /* http 层已提示 */
  }
}

onMounted(fetchList);
</script>

<template>
  <div v-loading="loading" class="admin-tickets-page">
    <div class="page-header">
      <h2>工单管理（平台）</h2>
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="fetchList">
        <el-option v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
    </div>

    <el-table :data="list" border>
      <el-table-column prop="ticketNo" label="工单号" width="190" />
      <el-table-column prop="subject" label="主题" min-width="180" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="STATUS_TYPES[row.status] ?? 'info'" size="small">
            {{ STATUS_LABELS[row.status] ?? row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="店铺/商户" width="180">
        <template #default="{ row }">
          {{ row.shop?.name ?? '-' }}
          <div style="font-size: 12px; color: #94a3b8">{{ row.shop?.merchant?.name }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="buyerEmail" label="买家" width="200" show-overflow-tooltip />
      <el-table-column label="最后回复" width="170">
        <template #default="{ row }">
          <span v-if="row.lastRepliedAt">
            {{ ROLE_LABELS[row.lastRepliedByRole ?? ''] }}
            · {{ new Date(row.lastRepliedAt).toLocaleString('zh-CN') }}
          </span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row as Ticket)">处理</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="detailVisible" title="工单处理" size="640px">
      <template v-if="detail">
        <div class="detail-header">
          <h3>{{ detail.subject }}</h3>
          <div>
            <el-tag :type="STATUS_TYPES[detail.status] ?? 'info'" size="small" style="margin-right: 8px">
              {{ STATUS_LABELS[detail.status] ?? detail.status }}
            </el-tag>
            <el-button
              v-if="!['RESOLVED', 'CLOSED', 'AUTO_REFUNDED'].includes(detail.status)"
              size="small"
              type="success"
              @click="resolve"
            >
              标记已解决
            </el-button>
          </div>
        </div>
        <div class="detail-meta">
          <div>工单号：{{ detail.ticketNo }}</div>
          <div>买家：{{ detail.buyerEmail }}</div>
          <div v-if="detail.shop">店铺：{{ detail.shop.name }}（{{ detail.shop.merchant?.name }}）</div>
          <div v-if="detail.order">
            订单：{{ detail.order.orderNo }} · ¥{{ Number(detail.order.totalAmount).toFixed(2) }}
          </div>
          <div v-if="detail.autoRefundAt" style="color: #ef4444">
            ⏰ 自动退款：{{ new Date(detail.autoRefundAt).toLocaleString('zh-CN') }}
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
              <el-tag v-if="msg.isInternal" size="small" type="warning">内部备注</el-tag>
            </div>
            <div class="msg-content">{{ msg.content }}</div>
            <div class="msg-time">{{ new Date(msg.createdAt).toLocaleString('zh-CN') }}</div>
          </div>
        </div>

        <div class="reply-area">
          <el-input v-model="replyText" type="textarea" :rows="3" placeholder="输入回复内容..." />
          <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center">
            <el-checkbox v-model="isInternal">仅内部备注（买家/商户不可见）</el-checkbox>
            <el-button type="primary" :disabled="!replyText.trim()" @click="reply">发送</el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.admin-tickets-page {
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
  color: #64748b;
  background: #f8fafc;
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
  background: #f1f5f9;
}
.msg-merchant {
  background: #dcfce7;
}
.msg-platform {
  background: #fef3c7;
}
.msg-internal {
  border: 1px dashed #f59e0b;
}
.msg-sender {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 4px;
}
.msg-content {
  font-size: 14px;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.reply-area {
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}
</style>
