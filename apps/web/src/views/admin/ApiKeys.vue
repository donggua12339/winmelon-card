<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { get, post, del } from '@/api/http';

interface ApiKey {
  id: string;
  keyHint: string;
  name: string;
  scopes: string;
  rateLimitPerMin: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CreatedKey {
  id: string;
  key: string;
  keyHint: string;
  name: string;
  scopes: string;
  rateLimitPerMin: number;
  expiresAt: string | null;
  createdAt: string;
}

const list = ref<ApiKey[]>([]);
const loading = ref(false);
const showDialog = ref(false);
const createdKey = ref<CreatedKey | null>(null);
const formRef = ref<FormInstance>();
const form = reactive({
  name: '',
  scopes: ['read', 'write'] as string[],
  rateLimitPerMin: 60,
  expiresAt: '' as string,
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  scopes: [{ required: true, message: '至少选择一个权限', trigger: 'change' }],
};

async function fetchList(): Promise<void> {
  loading.value = true;
  try {
    const data = await get<{ items: ApiKey[] }>('/admin/api-keys');
    list.value = data.items;
  } finally {
    loading.value = false;
  }
}

async function onCreate(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  const payload: Record<string, unknown> = {
    name: form.name,
    scopes: form.scopes,
    rateLimitPerMin: form.rateLimitPerMin,
  };
  if (form.expiresAt) {
    payload.expiresAt = new Date(form.expiresAt).toISOString();
  }

  try {
    const data = await post<CreatedKey>('/admin/api-keys', payload);
    createdKey.value = data;
    showDialog.value = false;
    ElMessage.success('API Key 创建成功');
    form.name = '';
    form.scopes = ['read', 'write'];
    form.rateLimitPerMin = 60;
    form.expiresAt = '';
    await fetchList();
  } catch {
    /* http 层已处理 */
  }
}

async function onRevoke(row: ApiKey): Promise<void> {
  await ElMessageBox.confirm(`确定吊销 API Key "${row.name}"？吊销后使用此 Key 的请求将立即失败。`, '危险操作', {
    type: 'warning',
    confirmButtonText: '确定吊销',
    cancelButtonText: '取消',
  });
  await del(`/admin/api-keys/${row.id}`);
  ElMessage.success('已吊销');
  await fetchList();
}

function copyKey(): void {
  if (!createdKey.value) return;
  navigator.clipboard.writeText(createdKey.value.key).then(() => {
    ElMessage.success('已复制到剪贴板');
  });
}

function closeCreatedDialog(): void {
  createdKey.value = null;
}

onMounted(fetchList);
</script>

<template>
  <div class="api-keys-page">
    <div class="page-header">
      <div>
        <h2>API Key 管理</h2>
        <p class="hint">用于对接外部系统，调用开放 API（/open/v1/*）</p>
      </div>
      <el-button type="primary" @click="showDialog = true">+ 新建 API Key</el-button>
    </div>

    <el-alert type="warning" :closable="false" class="warn-alert">
      <template #title>
        安全提示：API Key 等同于商户凭证，请妥善保管。创建后只显示一次完整 Key，遗失需重新生成。
      </template>
    </el-alert>

    <el-table v-loading="loading" :data="list" border>
      <el-table-column label="名称" prop="name" min-width="120" />
      <el-table-column label="Key 前缀" prop="keyHint" width="160">
        <template #default="{ row }">
          <code class="key-hint">{{ row.keyHint }}</code>
        </template>
      </el-table-column>
      <el-table-column label="权限" prop="scopes" width="120" />
      <el-table-column label="限流/分钟" prop="rateLimitPerMin" width="100" />
      <el-table-column label="最近使用" width="160">
        <template #default="{ row }">
          {{ row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '从未使用' }}
        </template>
      </el-table-column>
      <el-table-column label="过期时间" width="160">
        <template #default="{ row }">
          {{ row.expiresAt ? new Date(row.expiresAt).toLocaleString() : '永久' }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="danger" size="small" link @click="onRevoke(row)">吊销</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新建对话框 -->
    <el-dialog v-model="showDialog" title="新建 API Key" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：ERP 对接 / 自动化脚本" />
        </el-form-item>
        <el-form-item label="权限范围" prop="scopes">
          <el-checkbox-group v-model="form.scopes">
            <el-checkbox value="read">read（查询）</el-checkbox>
            <el-checkbox value="write">write（创建/修改）</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="限流（次/分钟）">
          <el-input-number v-model="form.rateLimitPerMin" :min="1" :max="600" />
        </el-form-item>
        <el-form-item label="过期时间（可选）">
          <el-date-picker
            v-model="form.expiresAt"
            type="datetime"
            placeholder="留空表示永久"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 创建成功对话框 -->
    <el-dialog
      :model-value="!!createdKey"
      title="API Key 创建成功"
      width="560px"
      :close-on-click-modal="false"
      :show-close="false"
      @close="closeCreatedDialog"
    >
      <el-alert type="warning" :closable="false" show-icon>
        <template #title> 这是您唯一一次看到完整 Key，请立即复制保存。关闭后将无法再次查看。 </template>
      </el-alert>
      <div v-if="createdKey" class="created-key">
        <code>{{ createdKey.key }}</code>
        <el-button size="small" @click="copyKey">复制</el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="closeCreatedDialog">我已保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.api-keys-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 4px;
}

.hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.warn-alert {
  margin-bottom: 16px;
}

.key-hint {
  font-family: 'Courier New', monospace;
  background: var(--el-fill-color-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.created-key {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 16px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.created-key code {
  flex: 1;
  word-break: break-all;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}
</style>
