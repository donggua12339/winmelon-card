<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { get } from '@/api/http';

interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  beforeData: unknown;
  afterData: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}
interface ListResult {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

const loading = ref(false);
const list = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const filter = reactive({
  action: '',
  resourceType: '',
  actorName: '',
  ip: '',
});

const detailVisible = ref(false);
const detail = ref<AuditLog | null>(null);

const resourceTypes = ['user', 'product', 'stock_card', 'order', 'payment', 'shop', 'payment_channel'];

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      pageSize: pageSize.value,
    };
    if (filter.action) params.action = filter.action;
    if (filter.resourceType) params.resourceType = filter.resourceType;
    if (filter.actorName) params.actorName = filter.actorName;
    if (filter.ip) params.ip = filter.ip;

    const data = await get<ListResult>('/admin/audit-logs', { params });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function onSearch(): void {
  page.value = 1;
  fetchList();
}

function onReset(): void {
  filter.action = '';
  filter.resourceType = '';
  filter.actorName = '';
  filter.ip = '';
  page.value = 1;
  fetchList();
}

function openDetail(row: AuditLog): void {
  detail.value = row;
  detailVisible.value = true;
}

function actionTag(a: string): { type: string; text: string } {
  if (a.includes('login.success')) return { type: 'success', text: '登录成功' };
  if (a.includes('login.failed')) return { type: 'danger', text: '登录失败' };
  if (a.includes('logout')) return { type: 'info', text: '登出' };
  if (a.includes('create')) return { type: 'success', text: '创建' };
  if (a.includes('update')) return { type: 'warning', text: '更新' };
  if (a.includes('delete')) return { type: 'danger', text: '删除' };
  if (a.includes('online') || a.includes('offline')) return { type: 'warning', text: '上下架' };
  if (a.includes('import')) return { type: 'success', text: '导入' };
  if (a.includes('reveal')) return { type: 'warning', text: '查看明文' };
  if (a.includes('delivery')) return { type: 'success', text: '发卡' };
  if (a.includes('payment')) return { type: 'primary', text: '支付' };
  return { type: 'info', text: a };
}

function formatTime(s: string): string {
  return new Date(s).toLocaleString();
}

function formatJson(v: unknown): string {
  if (v === null || v === undefined) return '-';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

onMounted(fetchList);
</script>

<template>
  <div>
    <div class="page-header">
      <h2>审计日志</h2>
      <p class="page-desc">记录所有关键操作，可用于追溯与排查</p>
    </div>

    <!-- 筛选 -->
    <div class="glass filter-bar">
      <el-input v-model="filter.action" placeholder="动作（如 login.success）" clearable style="width: 200px" />
      <el-select v-model="filter.resourceType" placeholder="资源类型" clearable style="width: 160px">
        <el-option v-for="t in resourceTypes" :key="t" :label="t" :value="t" />
      </el-select>
      <el-input v-model="filter.actorName" placeholder="操作人" clearable style="width: 160px" />
      <el-input v-model="filter.ip" placeholder="IP 地址" clearable style="width: 160px" />
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button @click="onReset">重置</el-button>
    </div>

    <!-- 列表 -->
    <el-table v-loading="loading" :data="list" border style="margin-top: 16px">
      <el-table-column prop="createdAt" label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="actorName" label="操作人" width="120" />
      <el-table-column label="动作" width="120">
        <template #default="{ row }">
          <el-tag :type="actionTag(row.action).type as any" size="small">{{ actionTag(row.action).text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="resourceType" label="资源类型" width="120" />
      <el-table-column prop="resourceId" label="资源 ID" min-width="200" show-overflow-tooltip />
      <el-table-column prop="ip" label="IP" width="140" />
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDetail(row as AuditLog)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px"
      @current-change="fetchList"
      @size-change="fetchList"
    />

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="日志详情" width="640px">
      <template v-if="detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="动作">{{ detail.action }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ detail.actorName ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="用户 ID">{{ detail.actorId ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="资源类型">{{ detail.resourceType }}</el-descriptions-item>
          <el-descriptions-item label="资源 ID">{{ detail.resourceId ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="IP">{{ detail.ip ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="Request ID">{{ detail.requestId ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="User Agent" :span="2">{{ detail.userAgent ?? '-' }}</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 16px">变更前</h4>
        <pre class="json-box">{{ formatJson(detail.beforeData) }}</pre>

        <h4 style="margin-top: 16px">变更后</h4>
        <pre class="json-box">{{ formatJson(detail.afterData) }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 16px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px;
}

.page-desc {
  color: var(--wm-text-secondary);
  font-size: 13px;
  margin: 0;
}

.filter-bar {
  padding: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.json-box {
  background: rgba(0, 0, 0, 0.3);
  color: var(--wm-text-primary);
  padding: 12px;
  border-radius: 6px;
  font-family: var(--wm-font-mono);
  font-size: 12px;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
