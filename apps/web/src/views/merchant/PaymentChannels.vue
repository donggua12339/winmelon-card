<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '@/api/http';

interface Channel {
  code: string;
  name: string;
  platformAvailable: boolean;
  merchantEnabled: boolean;
  canEnable: boolean;
}

const channels = ref<Channel[]>([]);
const loading = ref(false);

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    channels.value = await get<Channel[]>('/merchant/payment-channels');
  } finally {
    loading.value = false;
  }
}

async function toggle(row: Channel, enabled: boolean): Promise<void> {
  if (enabled && !row.canEnable) {
    ElMessage.warning('平台已禁用此通道，无法启用');
    return;
  }
  try {
    await put(`/merchant/payment-channels/${row.code}`, { isEnabled: enabled });
    row.merchantEnabled = enabled;
    ElMessage.success(`${enabled ? '已启用' : '已关闭'} ${row.name}`);
  } catch {
    /* http 层已提示 */
  }
}

onMounted(fetchList);
</script>

<template>
  <div class="payment-channels-page">
    <div class="page-header">
      <h2>支付通道</h2>
      <p class="tip">选择本店铺支持的支付方式。买家下单时只能选择你启用的通道。</p>
    </div>

    <el-card v-loading="loading" shadow="never">
      <div class="channel-list">
        <div v-for="ch in channels" :key="ch.code" class="channel-item">
          <div class="channel-info">
            <span class="channel-name">{{ ch.name }}</span>
            <el-tag size="small" :type="ch.platformAvailable ? 'success' : 'danger'">
              {{ ch.platformAvailable ? '平台可用' : '平台已禁用' }}
            </el-tag>
            <code class="channel-code">{{ ch.code }}</code>
          </div>
          <el-switch
            :model-value="ch.merchantEnabled"
            :disabled="!ch.canEnable"
            @change="(val: boolean | string | number) => toggle(ch, Boolean(val))"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.payment-channels-page {
  padding: 16px;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.page-header .tip {
  margin: 0;
  font-size: 13px;
  color: var(--wm-text-secondary);
}
.channel-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--wm-border-default);
  border-radius: 8px;
}
.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.channel-name {
  font-weight: 600;
  font-size: 15px;
}
.channel-code {
  font-size: 12px;
  color: var(--wm-text-secondary);
  background: var(--wm-border-default);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
