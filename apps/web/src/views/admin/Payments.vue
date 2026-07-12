<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '@/api/http';

interface Channel {
  id: string;
  code: string;
  name: string;
  isAvailable: boolean;
  updatedAt: string;
}
interface ChannelDetail {
  code: string;
  name: string;
  isAvailable: boolean;
  config: Record<string, unknown>;
}

const loading = ref(false);
const channels = ref<Channel[]>([]);

const editVisible = ref(false);
const editForm = reactive({
  code: '',
  name: '',
  isAvailable: false,
  config: '' as string,
});
const saving = ref(false);

async function fetchChannels(): Promise<void> {
  loading.value = true;
  try {
    channels.value = await get<Channel[]>('/admin/payment-channels');
  } finally {
    loading.value = false;
  }
}

async function openEdit(code: string): Promise<void> {
  const detail = await get<ChannelDetail>(`/admin/payment-channels/${code}`);
  editForm.code = detail.code;
  editForm.name = detail.name;
  editForm.isAvailable = detail.isAvailable;
  editForm.config = JSON.stringify(detail.config, null, 2);
  editVisible.value = true;
}

async function onSave(): Promise<void> {
  let configObj: Record<string, unknown> = {};
  try {
    configObj = editForm.config ? JSON.parse(editForm.config) : {};
  } catch {
    ElMessage.error('配置必须是合法 JSON');
    return;
  }

  saving.value = true;
  try {
    await put(`/admin/payment-channels/${editForm.code}`, {
      name: editForm.name,
      isAvailable: editForm.isAvailable,
      config: configObj,
    });
    ElMessage.success('保存成功');
    editVisible.value = false;
    fetchChannels();
  } finally {
    saving.value = false;
  }
}

async function toggleAvailable(ch: Channel): Promise<void> {
  await put(`/admin/payment-channels/${ch.code}`, { isAvailable: !ch.isAvailable });
  ElMessage.success(ch.isAvailable ? '已禁用' : '已启用');
  fetchChannels();
}

function channelDesc(code: string): string {
  const map: Record<string, string> = {
    epay: '彩虹易支付，支持支付宝/微信，个人免签约',
    mock: '模拟支付通道，仅用于开发测试',
  };
  return map[code] ?? '';
}

onMounted(fetchChannels);
</script>

<template>
  <div class="payments">
    <div class="page-header">
      <h2>支付通道配置</h2>
      <p class="page-desc">管理各支付通道的接入参数与启用状态</p>
    </div>

    <div v-loading="loading" class="channels-grid">
      <div v-for="ch in channels" :key="ch.id" class="glass channel-card">
        <div class="channel-header">
          <div class="channel-icon">{{ ch.code === 'epay' ? '🌈' : '🧪' }}</div>
          <div class="channel-info">
            <div class="channel-name">{{ ch.name }}</div>
            <div class="channel-code">{{ ch.code }}</div>
          </div>
          <el-switch :model-value="ch.isAvailable" @change="toggleAvailable(ch)" />
        </div>

        <p class="channel-desc">{{ channelDesc(ch.code) }}</p>

        <div class="channel-footer">
          <span class="updated">更新于 {{ new Date(ch.updatedAt).toLocaleString() }}</span>
          <el-button link type="primary" @click="openEdit(ch.code)">配置</el-button>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="通道配置" width="560px">
      <el-form label-position="top">
        <el-form-item label="通道名称">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="editForm.isAvailable" />
        </el-form-item>
        <el-form-item label="配置（JSON）">
          <el-input
            v-model="editForm.config"
            type="textarea"
            :rows="8"
            placeholder='{"pid":"","key":"","apiDomain":""}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.payments {
  max-width: 1000px;
  margin: 0 auto;
}

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

.channels-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.channel-card {
  padding: 24px;
}

.channel-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.channel-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--wm-radius-md);
  background: var(--wm-glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.channel-info {
  flex: 1;
}

.channel-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--wm-text-primary);
}

.channel-code {
  font-size: 12px;
  color: var(--wm-text-tertiary);
  font-family: var(--wm-font-mono);
}

.channel-desc {
  font-size: 13px;
  color: var(--wm-text-secondary);
  line-height: 1.6;
  margin: 0 0 16px;
  min-height: 40px;
}

.channel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--wm-border-glass);
}

.updated {
  font-size: 12px;
  color: var(--wm-text-tertiary);
}
</style>
