<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { get, post } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

const auth = useAuthStore();
const unreadCount = ref(0);
const list = ref<Notification[]>([]);
const drawerVisible = ref(false);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const TYPE_ICONS: Record<string, string> = {
  ORDER: '🛒',
  WITHDRAWAL: '💰',
  TICKET: '🎫',
  SYSTEM: '📢',
  COMMISSION: '🎟️',
};

async function fetchUnread(): Promise<void> {
  if (!auth.isAuthenticated) return;
  try {
    const res = await get<{ unreadCount: number }>(
      auth.roles.includes('SUPER_ADMIN') ? '/admin/notifications' : '/merchant/notifications',
      { params: { page: 1, pageSize: 1 } },
    );
    // 平台端没有 unreadCount 字段，商户端有
    if ('unreadCount' in res) {
      unreadCount.value = res.unreadCount;
    }
  } catch {
    /* 静默 */
  }
}

async function openDrawer(): Promise<void> {
  drawerVisible.value = true;
  loading.value = true;
  try {
    const res = await get<{ items: Notification[]; unreadCount?: number }>(
      auth.roles.includes('SUPER_ADMIN') ? '/admin/notifications' : '/merchant/notifications',
      { params: { page: 1, pageSize: 50 } },
    );
    list.value = res.items;
    if (res.unreadCount !== undefined) unreadCount.value = res.unreadCount;
  } finally {
    loading.value = false;
  }
}

async function markRead(n: Notification): Promise<void> {
  if (n.isRead) return;
  try {
    await post(`/merchant/notifications/${n.id}/read`);
    n.isRead = true;
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } catch {
    /* http 层已提示 */
  }
}

async function markAllRead(): Promise<void> {
  try {
    await post('/merchant/notifications/read-all');
    list.value.forEach((n) => (n.isRead = true));
    unreadCount.value = 0;
    ElMessage.success('全部已读');
  } catch {
    /* http 层已提示 */
  }
}

function formatTime(t: string): string {
  const d = new Date(t);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return d.toLocaleDateString('zh-CN');
}

onMounted(() => {
  fetchUnread();
  // 30 秒轮询未读数
  pollTimer = setInterval(fetchUnread, 30_000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <el-badge :value="unreadCount > 99 ? '99+' : unreadCount" :hidden="unreadCount === 0" :max="99">
    <el-button circle @click="openDrawer">
      <span style="font-size: 16px">🔔</span>
    </el-button>
  </el-badge>

  <el-drawer v-model="drawerVisible" title="通知" size="420px">
    <div v-loading="loading">
      <div v-if="unreadCount > 0" style="margin-bottom: 12px">
        <el-button size="small" type="primary" link @click="markAllRead">全部标为已读</el-button>
      </div>
      <div v-if="list.length === 0" class="empty">
        <el-empty description="暂无通知" :image-size="80" />
      </div>
      <div v-else class="notif-list">
        <div v-for="n in list" :key="n.id" :class="['notif-item', { unread: !n.isRead }]" @click="markRead(n)">
          <div class="notif-icon">{{ TYPE_ICONS[n.type] ?? '📬' }}</div>
          <div class="notif-body">
            <div class="notif-title">{{ n.title }}</div>
            <div class="notif-content">{{ n.content }}</div>
            <div class="notif-time">{{ formatTime(n.createdAt) }}</div>
          </div>
          <span v-if="!n.isRead" class="unread-dot"></span>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.notif-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notif-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.notif-item:hover {
  background: #f8fafc;
}
.notif-item.unread {
  background: #eff6ff;
  border-color: #bfdbfe;
}
.notif-icon {
  font-size: 20px;
}
.notif-body {
  flex: 1;
  min-width: 0;
}
.notif-title {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 4px;
}
.notif-content {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.notif-time {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}
.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  align-self: flex-start;
  margin-top: 6px;
}
.empty {
  padding: 40px 0;
}
</style>
