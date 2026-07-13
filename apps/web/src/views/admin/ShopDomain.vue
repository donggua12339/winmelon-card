<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { get, put, post, del } from '@/api/http';

interface DomainInfo {
  shopId: string;
  shopCode: string;
  customDomain: string | null;
  verified: boolean;
  verifiedAt: string | null;
  verifyToken: string | null;
  dnsInstruction: {
    type: string;
    host: string;
    value: string;
    ttl: number;
    note?: string;
  } | null;
}

interface MyShop {
  id: string;
  code: string;
  name: string;
}

const loading = ref(false);
const submitting = ref(false);
const verifying = ref(false);
const domainInfo = ref<DomainInfo | null>(null);
const myShop = ref<MyShop | null>(null);
const formRef = ref<FormInstance>();
const showSetDialog = ref(false);

const form = reactive({
  domain: '',
});

const rules: FormRules<typeof form> = {
  domain: [
    { required: true, message: '请输入域名', trigger: 'blur' },
    {
      pattern: /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
      message: '域名格式不正确（如 shop.example.com）',
      trigger: 'blur',
    },
  ],
};

async function fetchShop(): Promise<void> {
  const shop = await get<MyShop>('/admin/shops/me');
  myShop.value = shop;
}

async function fetchDomain(): Promise<void> {
  if (!myShop.value) return;
  loading.value = true;
  try {
    const info = await get<DomainInfo>(`/admin/shops/${myShop.value.id}/domain`);
    domainInfo.value = info;
  } finally {
    loading.value = false;
  }
}

async function onSet(): Promise<void> {
  if (!formRef.value || !myShop.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const data = await put<{ dnsInstruction: { value: string; host: string } }>(
      `/admin/shops/${myShop.value.id}/domain`,
      { domain: form.domain.trim().toLowerCase() },
    );
    void data;
    ElMessage.success('域名已设置，请按提示添加 DNS 记录');
    form.domain = '';
    showSetDialog.value = false;
    await fetchDomain();
  } finally {
    submitting.value = false;
  }
}

async function onVerify(): Promise<void> {
  if (!myShop.value) return;
  verifying.value = true;
  try {
    const data = await post<{ verified: boolean; verifiedAt: string }>(`/admin/shops/${myShop.value.id}/domain/verify`);
    if (data.verified) {
      ElMessage.success('域名验证成功！');
    }
    await fetchDomain();
  } catch {
    /* http 层处理 */
  } finally {
    verifying.value = false;
  }
}

async function onRemove(): Promise<void> {
  if (!myShop.value || !domainInfo.value?.customDomain) return;
  await ElMessageBox.confirm(
    `确定移除域名 ${domainInfo.value.customDomain}？移除后用户无法通过该域名访问店铺。`,
    '确认移除',
    { type: 'warning' },
  );
  await del(`/admin/shops/${myShop.value.id}/domain`);
  ElMessage.success('已移除');
  await fetchDomain();
}

function copy(text: string, label: string): void {
  navigator.clipboard.writeText(text).then(() => ElMessage.success(`${label}已复制`));
}

import { ElMessageBox } from 'element-plus';

onMounted(async () => {
  await fetchShop();
  await fetchDomain();
});
</script>

<template>
  <div class="domain-page">
    <h2>自定义域名</h2>
    <p class="hint">让买家通过您自己的域名（如 <code>shop.yourbrand.com</code>）访问店铺</p>

    <div v-loading="loading">
      <!-- 未设置 -->
      <el-empty v-if="!domainInfo?.customDomain" description="尚未设置自定义域名">
        <el-button type="primary" @click="showSetDialog = true">立即设置</el-button>
      </el-empty>

      <!-- 已设置 -->
      <div v-else>
        <el-card class="domain-card">
          <div class="domain-row">
            <span class="label">当前域名</span>
            <code class="domain-value">{{ domainInfo.customDomain }}</code>
            <el-tag :type="domainInfo.verified ? 'success' : 'warning'" size="large" effect="dark">
              {{ domainInfo.verified ? '已验证' : '待验证' }}
            </el-tag>
          </div>

          <div v-if="!domainInfo.verified" class="dns-section">
            <h4>📌 DNS 验证步骤</h4>
            <p>请到域名服务商 DNS 管理面板，添加以下 TXT 记录：</p>
            <el-table :data="[domainInfo.dnsInstruction]" border>
              <el-table-column label="类型" prop="type" width="100" />
              <el-table-column label="主机记录" min-width="200">
                <template #default="{ row }">
                  <code>{{ row.host }}</code>
                  <el-button size="small" link @click="copy(row.host, '主机记录')">复制</el-button>
                </template>
              </el-table-column>
              <el-table-column label="记录值" min-width="280">
                <template #default="{ row }">
                  <code class="token">{{ row.value }}</code>
                  <el-button size="small" link @click="copy(row.value, '记录值')">复制</el-button>
                </template>
              </el-table-column>
              <el-table-column label="TTL" prop="ttl" width="80" />
            </el-table>

            <el-alert type="info" :closable="false" class="dns-tip">
              TXT 记录生效可能需要 5-30 分钟。添加后点击下方"立即验证"按钮。
            </el-alert>

            <div class="actions">
              <el-button type="primary" :loading="verifying" @click="onVerify"> 立即验证 </el-button>
              <el-button @click="showSetDialog = true">更换域名</el-button>
              <el-button type="danger" link @click="onRemove">移除</el-button>
            </div>
          </div>

          <div v-else class="verified-section">
            <el-alert type="success" :closable="false">
              <template #title>
                ✅ 域名验证成功，已于 {{ new Date(domainInfo.verifiedAt!).toLocaleString() }} 通过验证
              </template>
              <p style="margin: 8px 0 0">
                下一步：将该域名 CNAME 或 A 记录指向平台服务器（联系管理员协助配置 Nginx server 块与 HTTPS 证书）
              </p>
            </el-alert>
            <div class="actions">
              <el-button @click="showSetDialog = true">更换域名</el-button>
              <el-button type="danger" link @click="onRemove">移除</el-button>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 设置域名对话框 -->
    <el-dialog v-model="showSetDialog" title="设置自定义域名" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="域名" prop="domain">
          <el-input v-model="form.domain" placeholder="shop.example.com" />
          <div class="tip">输入您拥有的域名（如 shop.yourbrand.com）。不能使用 winmelon.cn 主域。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSetDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSet">设置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.domain-page {
  padding: 20px;
  max-width: 800px;
}

.hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0 24px;
}

.domain-card {
  margin-top: 16px;
}

.domain-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.domain-row .label {
  width: 80px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.domain-value {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 16px;
  color: var(--el-color-primary);
  font-weight: 600;
}

.dns-section {
  margin-top: 20px;
}

.dns-section h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

.dns-section p {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}

.dns-tip {
  margin: 16px 0;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 8px;
}

.token {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
}

.verified-section {
  margin-top: 20px;
}

.tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}
</style>
