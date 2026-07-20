<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { get, put } from '@/api/http';

interface ShopInfo {
  id: string;
  code: string;
  name: string;
  announcement: string | null;
  footerHtml: string | null;
  isOnline: boolean;
  updatedAt: string;
}

const loading = ref(false);
const saving = ref(false);
const shop = ref<ShopInfo | null>(null);

const form = reactive({
  name: '',
  announcement: '',
  footerHtml: '',
  isOnline: true,
});

async function fetchShop(): Promise<void> {
  loading.value = true;
  try {
    shop.value = await get<ShopInfo>('/admin/shops/me');
    form.name = shop.value.name;
    form.announcement = shop.value.announcement ?? '';
    form.footerHtml = shop.value.footerHtml ?? '';
    form.isOnline = shop.value.isOnline;
  } finally {
    loading.value = false;
  }
}

async function onSave(): Promise<void> {
  if (!shop.value) return;
  saving.value = true;
  try {
    const updated = await put<ShopInfo>(`/admin/shops/${shop.value.id}`, {
      name: form.name,
      announcement: form.announcement || null,
      footerHtml: form.footerHtml || null,
      isOnline: form.isOnline,
    });
    shop.value = updated;
    ElMessage.success('保存成功');
  } finally {
    saving.value = false;
  }
}

onMounted(fetchShop);
</script>

<template>
  <div v-loading="loading" class="admin-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">系统配置</h2>
        <p class="page-desc">管理店铺信息、公告与在线状态</p>
      </div>
    </header>

    <section v-if="shop" class="panel">
      <div class="info-row">
        <span class="info-label">店铺编号</span>
        <code class="info-value">{{ shop.code }}</code>
      </div>

      <el-form label-position="top" class="form">
        <el-form-item label="店铺名称">
          <el-input v-model="form.name" placeholder="店铺名称" maxlength="128" show-word-limit />
        </el-form-item>

        <el-form-item label="店铺公告">
          <el-input
            v-model="form.announcement"
            type="textarea"
            :rows="3"
            placeholder="显示在店铺首页顶部的公告信息"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="底部 HTML（可选）">
          <el-input
            v-model="form.footerHtml"
            type="textarea"
            :rows="4"
            placeholder="自定义底部 HTML，如统计代码、客服代码等"
          />
          <div class="tip">支持原始 HTML，请确保内容安全，避免 XSS</div>
        </el-form-item>

        <el-form-item label="店铺状态">
          <el-switch v-model="form.isOnline" active-text="在线" inactive-text="下线" />
          <div class="tip">下线后买家将无法访问店铺</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">保存配置</el-button>
        </el-form-item>
      </el-form>

      <div class="info-row">
        <span class="info-label">最后更新</span>
        <span class="info-value">{{ new Date(shop.updatedAt).toLocaleString() }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 720px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--wm-space-xl);
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
  padding: var(--wm-space-xl);
  box-shadow: var(--wm-shadow-sm);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--wm-space-md) 0;
  border-bottom: 1px solid var(--wm-border-default);
  margin-bottom: var(--wm-space-md);
}

.info-label {
  color: var(--wm-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.info-value {
  color: var(--wm-text-primary);
  font-size: 14px;
  font-family: var(--wm-font-mono);
}

.form {
  margin-top: var(--wm-space-md);
}

.tip {
  color: var(--wm-text-tertiary);
  font-size: 12px;
  margin-top: var(--wm-space-2xs);
  line-height: 1.5;
}
</style>
