<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { get, post, del } from '@/api/http';

interface IpItem {
  id: string;
  ip: string;
  reason: string;
  source: string;
  expiresAt: string | null;
  createdAt: string;
}
interface EmailItem {
  id: string;
  email: string;
  reason: string;
  source: string;
  expiresAt: string | null;
  createdAt: string;
}
interface Stats {
  ipBlockedCount: number;
  emailBlockedCount: number;
  recordCount: number;
  topActions: { action: string; count: number }[];
  topIps: { ip: string; count: number }[];
}

const activeTab = ref('ip');
const loading = ref(false);
const ipList = ref<IpItem[]>([]);
const emailList = ref<EmailItem[]>([]);
const ipTotal = ref(0);
const emailTotal = ref(0);
const page = ref(1);
const pageSize = ref(20);
const keyword = ref('');
const stats = ref<Stats | null>(null);

const addIpVisible = ref(false);
const addIpForm = reactive({ ip: '', reason: '', hours: 1 });
const addEmailVisible = ref(false);
const addEmailForm = reactive({ email: '', reason: '', hours: 1 });
const saving = ref(false);

async function fetchIpList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: IpItem[]; total: number }>('/admin/risk/ip-blacklist', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined },
    });
    ipList.value = data.items;
    ipTotal.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function fetchEmailList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: EmailItem[]; total: number }>('/admin/risk/email-blacklist', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value || undefined },
    });
    emailList.value = data.items;
    emailTotal.value = data.total;
  } finally {
    loading.value = false;
  }
}

async function fetchStats(): Promise<void> {
  stats.value = await get<Stats>('/admin/risk/stats', { params: { days: 7 } });
}

function onSearch(): void {
  page.value = 1;
  if (activeTab.value === 'ip') fetchIpList();
  else fetchEmailList();
}

async function onAddIp(): Promise<void> {
  if (!addIpForm.ip || !addIpForm.reason) {
    ElMessage.warning('请填写 IP 和原因');
    return;
  }
  saving.value = true;
  try {
    await post('/admin/risk/ip-blacklist', addIpForm);
    ElMessage.success('已添加');
    addIpVisible.value = false;
    addIpForm.ip = '';
    addIpForm.reason = '';
    fetchIpList();
    fetchStats();
  } finally {
    saving.value = false;
  }
}

async function onAddEmail(): Promise<void> {
  if (!addEmailForm.email || !addEmailForm.reason) {
    ElMessage.warning('请填写邮箱和原因');
    return;
  }
  saving.value = true;
  try {
    await post('/admin/risk/email-blacklist', addEmailForm);
    ElMessage.success('已添加');
    addEmailVisible.value = false;
    addEmailForm.email = '';
    addEmailForm.reason = '';
    fetchEmailList();
    fetchStats();
  } finally {
    saving.value = false;
  }
}

async function onRemove(type: 'ip' | 'email', id: string): Promise<void> {
  await ElMessageBox.confirm('确定移除该黑名单记录？', '提示', { type: 'warning' });
  await del(`/admin/risk/${type}-blacklist/${id}`);
  ElMessage.success('已移除');
  if (type === 'ip') fetchIpList();
  else fetchEmailList();
  fetchStats();
}

function sourceTag(s: string): { type: string; text: string } {
  return s === 'auto' ? { type: 'danger', text: '自动' } : { type: 'info', text: '手动' };
}

function formatTime(s: string | null): string {
  if (!s) return '永久';
  return new Date(s).toLocaleString();
}

function isExpired(s: string | null): boolean {
  if (!s) return false;
  return new Date(s).getTime() < Date.now();
}

onMounted(() => {
  fetchIpList();
  fetchStats();
});
</script>

<template>
  <div>
    <div class="page-header">
      <h2>行为风控</h2>
      <p class="page-desc">IP/邮箱黑名单管理 + 风控统计</p>
    </div>

    <!-- 统计卡片 -->
    <div v-if="stats" class="stats-grid">
      <div class="glass stat-card">
        <div class="stat-icon">🚫</div>
        <div class="stat-info">
          <div class="stat-label">IP 黑名单</div>
          <div class="stat-value num-highlight">{{ stats.ipBlockedCount }}</div>
        </div>
      </div>
      <div class="glass stat-card">
        <div class="stat-icon">📧</div>
        <div class="stat-info">
          <div class="stat-label">邮箱黑名单</div>
          <div class="stat-value num-highlight">{{ stats.emailBlockedCount }}</div>
        </div>
      </div>
      <div class="glass stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <div class="stat-label">7 天行为记录</div>
          <div class="stat-value num-highlight">{{ stats.recordCount }}</div>
        </div>
      </div>
    </div>

    <!-- 高频 IP -->
    <div v-if="stats && stats.topIps.length > 0" class="glass top-section">
      <h3 class="section-title">高频 IP Top 10（7 天）</h3>
      <div class="ip-chips">
        <el-tag v-for="ip in stats.topIps" :key="ip.ip" type="warning" size="large">
          {{ ip.ip }} ({{ ip.count }} 次)
        </el-tag>
      </div>
    </div>

    <!-- 黑名单管理 -->
    <el-tabs v-model="activeTab" class="glass tabs-card" @tab-change="() => (page = 1)">
      <el-tab-pane label="IP 黑名单" name="ip">
        <div class="filter-bar">
          <el-input v-model="keyword" placeholder="搜索 IP" clearable style="width: 200px" @keyup.enter="onSearch" />
          <el-button @click="onSearch">搜索</el-button>
          <el-button type="primary" @click="addIpVisible = true">+ 添加</el-button>
        </div>
        <el-table v-loading="loading" :data="ipList" border>
          <el-table-column prop="ip" label="IP" min-width="160" />
          <el-table-column prop="reason" label="原因" min-width="240" show-overflow-tooltip />
          <el-table-column label="来源" width="100">
            <template #default="{ row }">
              <el-tag :type="sourceTag(row.source).type as any" size="small">{{ sourceTag(row.source).text }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="到期" width="180">
            <template #default="{ row }">
              <span :class="{ expired: isExpired(row.expiresAt) }">{{ formatTime(row.expiresAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="180">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" size="small" @click="onRemove('ip', row.id)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="ipTotal"
          layout="total, prev, pager, next"
          style="margin-top: 16px"
          @current-change="fetchIpList"
        />
      </el-tab-pane>

      <el-tab-pane label="邮箱黑名单" name="email">
        <div class="filter-bar">
          <el-input v-model="keyword" placeholder="搜索邮箱" clearable style="width: 240px" @keyup.enter="onSearch" />
          <el-button @click="onSearch">搜索</el-button>
          <el-button type="primary" @click="addEmailVisible = true">+ 添加</el-button>
        </div>
        <el-table v-loading="loading" :data="emailList" border>
          <el-table-column prop="email" label="邮箱" min-width="200" />
          <el-table-column prop="reason" label="原因" min-width="240" show-overflow-tooltip />
          <el-table-column label="来源" width="100">
            <template #default="{ row }">
              <el-tag :type="sourceTag(row.source).type as any" size="small">{{ sourceTag(row.source).text }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="到期" width="180">
            <template #default="{ row }">
              <span :class="{ expired: isExpired(row.expiresAt) }">{{ formatTime(row.expiresAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="180">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" size="small" @click="onRemove('email', row.id)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="emailTotal"
          layout="total, prev, pager, next"
          style="margin-top: 16px"
          @current-change="fetchEmailList"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 添加 IP 黑名单 -->
    <el-dialog v-model="addIpVisible" title="添加 IP 黑名单" width="480px">
      <el-form label-position="top">
        <el-form-item label="IP 地址">
          <el-input v-model="addIpForm.ip" placeholder="如 1.2.3.4" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="addIpForm.reason" type="textarea" :rows="2" placeholder="如 恶意刷单" />
        </el-form-item>
        <el-form-item label="时长（小时，空=永久）">
          <el-input-number v-model="addIpForm.hours" :min="1" :max="720" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addIpVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onAddIp">添加</el-button>
      </template>
    </el-dialog>

    <!-- 添加邮箱黑名单 -->
    <el-dialog v-model="addEmailVisible" title="添加邮箱黑名单" width="480px">
      <el-form label-position="top">
        <el-form-item label="邮箱">
          <el-input v-model="addEmailForm.email" placeholder="如 spammer@test.com" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="addEmailForm.reason" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="时长（小时，空=永久）">
          <el-input-number v-model="addEmailForm.hours" :min="1" :max="720" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addEmailVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onAddEmail">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 24px;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--wm-radius-md);
  background: var(--wm-glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  line-height: 1;
}

.top-section {
  padding: 20px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
}

.ip-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tabs-card {
  padding: 16px 20px;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.expired {
  color: var(--wm-text-tertiary);
  text-decoration: line-through;
}
</style>
