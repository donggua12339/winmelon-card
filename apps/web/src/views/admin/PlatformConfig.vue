<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '@/api/http';

interface ConfigItem {
  key: string;
  value: string;
  description?: string | null;
  updatedAt: string;
}

const loading = ref(false);
const saving = ref<string | null>(null);
const configs = ref<ConfigItem[]>([]);

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: ConfigItem[] }>('/admin/system-config');
    configs.value = data.items;
  } finally {
    loading.value = false;
  }
}

async function save(item: ConfigItem): Promise<void> {
  saving.value = item.key;
  try {
    await put(`/admin/system-config/${item.key}`, { value: item.value });
    ElMessage.success(`${item.key} 已更新`);
    fetchList();
  } finally {
    saving.value = null;
  }
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    commission_level_1_rate: '1 级返佣比例',
    commission_level_2_rate: '2 级返佣比例',
    commission_level_3_rate: '3 级返佣比例',
    buyer_invite_code_global_enabled: '全局下单填邀请码开关',
    leaderboard_enabled: '排行榜功能开关',
    commission_rate: '旧版单层返佣比例',
    finance_tolerance_yuan: '财务对账容差',
  };
  return labels[key] ?? key;
}

function isBoolean(key: string): boolean {
  return ['buyer_invite_code_global_enabled', 'leaderboard_enabled'].includes(key);
}

function isRate(key: string): boolean {
  return key.includes('rate');
}

onMounted(fetchList);
</script>

<template>
  <div class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">平台配置</h2>
        <p class="page-desc">系统级配置项（返佣比例、功能开关）</p>
      </div>
      <el-button @click="fetchList">刷新</el-button>
    </header>

    <section v-loading="loading" class="panel">
      <h3 class="panel-title">分销配置</h3>
      <el-table :data="configs" :border="false" stripe>
        <el-table-column label="配置项" min-width="220">
          <template #default="{ row }">
            <div class="config-label">{{ formatLabel(row.key) }}</div>
            <code class="config-key">{{ row.key }}</code>
          </template>
        </el-table-column>
        <el-table-column label="值" width="280">
          <template #default="{ row }">
            <el-switch
              v-if="isBoolean(row.key)"
              v-model="row.value"
              active-value="true"
              inactive-value="false"
              @change="save(row as ConfigItem)"
            />
            <el-input-number
              v-else-if="isRate(row.key)"
              v-model="row.value"
              :min="0"
              :max="1"
              :step="0.005"
              :precision="4"
              style="width: 160px"
            />
            <el-input v-else v-model="row.value" style="width: 200px" />
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="280">
          <template #default="{ row }">
            <span class="config-desc">{{ row.description ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">{{ new Date(row.updatedAt).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!isBoolean(row.key)"
              link
              type="primary"
              size="small"
              :loading="saving === row.key"
              @click="save(row as ConfigItem)"
            >
              保存
            </el-button>
            <span v-else class="text-tertiary text-sm">自动保存</span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="panel">
      <h3 class="panel-title">配置说明</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="1/2/3 级返佣比例">
          多级分销返佣比例。1 级 = 直接邀请人，2 级 = 邀请人的邀请人，3 级 = 3 级上线。 默认 0.03 / 0.01 / 0.005（总成本
          4.5%）
        </el-descriptions-item>
        <el-descriptions-item label="全局下单填邀请码开关">
          控制买家下单时是否可填邀请码（单级返佣）。商户级需同时开启 allowBuyerInviteCode 才生效
        </el-descriptions-item>
        <el-descriptions-item label="排行榜功能开关"> 控制商户工作台是否显示分销排行榜。默认关 </el-descriptions-item>
      </el-descriptions>
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

.panel {
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  padding: var(--wm-space-lg);
  margin-bottom: var(--wm-space-lg);
  box-shadow: var(--wm-shadow-sm);
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wm-text-primary);
  margin: 0 0 var(--wm-space-md);
}

.config-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--wm-text-primary);
  margin-bottom: 2px;
}

.config-key {
  font-family: var(--wm-font-mono);
  font-size: 12px;
  color: var(--wm-text-tertiary);
  background: var(--wm-bg-hover);
  padding: 1px 6px;
  border-radius: 3px;
}

.config-desc {
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.text-tertiary {
  color: var(--wm-text-tertiary);
}

.text-sm {
  font-size: 12px;
}
</style>
