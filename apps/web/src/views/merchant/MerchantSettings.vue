<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { get, post } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

interface Profile {
  id: string;
  code: string;
  name: string;
  contactEmail: string;
  status: string;
  themeColor: string | null;
  shops: { id: string; code: string; name: string; customDomain: string | null; domainVerified: boolean }[];
  createdAt: string;
}

const auth = useAuthStore();
const profile = ref<Profile | null>(null);

// 主题色预设
const presetColors = [
  '#7c3aed',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

// 主题色表单
const themeRef = ref<FormInstance>();
const themeForm = reactive({ color: '#7c3aed' });
const themeRules: FormRules<typeof themeForm> = {
  color: [
    {
      pattern: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
      message: '格式不正确（如 #7c3aed）',
      trigger: 'blur',
    },
  ],
};
const savingTheme = ref(false);

// 密码表单
const pwRef = ref<FormInstance>();
const pwForm = reactive({ oldPassword: '', newPassword: '', confirm: '' });
const pwRules: FormRules<typeof pwForm> = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '至少 8 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v, cb) => (v === pwForm.newPassword ? cb() : cb(new Error('两次密码不一致'))),
      trigger: 'blur',
    },
  ],
};
const changingPw = ref(false);

async function fetchProfile(): Promise<void> {
  const data = await get<Profile>('/merchant/profile');
  profile.value = data;
  themeForm.color = data.themeColor ?? '#7c3aed';
  // 立即同步到 store（供 Layout 使用）
  auth.setMerchantInfo({ merchantName: data.name, themeColor: themeForm.color });
}

async function saveTheme(): Promise<void> {
  if (!themeRef.value) return;
  const valid = await themeRef.value.validate().catch(() => false);
  if (!valid) return;
  savingTheme.value = true;
  try {
    await post('/merchant/profile/theme', { color: themeForm.color });
    ElMessage.success('主题色已更新');
    auth.setMerchantInfo({ themeColor: themeForm.color });
  } finally {
    savingTheme.value = false;
  }
}

async function changePassword(): Promise<void> {
  if (!pwRef.value) return;
  const valid = await pwRef.value.validate().catch(() => false);
  if (!valid) return;
  changingPw.value = true;
  try {
    await post('/merchant/profile/password', {
      oldPassword: pwForm.oldPassword,
      newPassword: pwForm.newPassword,
    });
    ElMessage.success('密码修改成功，请重新登录');
    setTimeout(() => auth.logout(), 1500);
  } finally {
    changingPw.value = false;
  }
}

onMounted(fetchProfile);
</script>

<template>
  <div v-loading="!profile" class="merchant-settings">
    <p class="page-subtitle">基本资料、主题色、修改密码</p>

    <!-- 基本信息 -->
    <el-card v-if="profile" class="section">
      <template #header>基本信息</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="商户名称">{{ profile.name }}</el-descriptions-item>
        <el-descriptions-item label="商户编码">{{ profile.code }}</el-descriptions-item>
        <el-descriptions-item label="联系邮箱">{{ profile.contactEmail }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="profile.status === 'ACTIVE' ? 'success' : 'warning'">
            {{ profile.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="店铺数量">{{ profile.shops.length }}</el-descriptions-item>
        <el-descriptions-item label="入驻时间">
          {{ new Date(profile.createdAt).toLocaleString() }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 主题色 -->
    <el-card class="section">
      <template #header>工作台主题色</template>
      <el-form ref="themeRef" :model="themeForm" :rules="themeRules" label-position="top">
        <el-form-item label="主题色">
          <el-color-picker v-model="themeForm.color" :predefine="presetColors" show-alpha="{false}" />
          <span class="theme-preview" :style="{ background: themeForm.color }"></span>
          <code class="theme-hex">{{ themeForm.color }}</code>
        </el-form-item>
        <el-form-item label="预设颜色">
          <div class="preset-row">
            <button
              v-for="c in presetColors"
              :key="c"
              class="preset-swatch"
              :style="{ background: c }"
              :class="{ active: themeForm.color === c }"
              @click="themeForm.color = c"
            />
          </div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="savingTheme" @click="saveTheme">保存主题色</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 修改密码 -->
    <el-card class="section">
      <template #header>修改密码</template>
      <el-form ref="pwRef" :model="pwForm" :rules="pwRules" label-width="120px">
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="pwForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="pwForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirm">
          <el-input v-model="pwForm.confirm" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="changingPw" @click="changePassword"> 修改密码 </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.merchant-settings {
  max-width: 800px;
  margin: 0 auto;
}

.page-subtitle {
  margin: 0 0 20px;
  color: #64748b;
  font-size: 13px;
}

.section {
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.section :deep(.el-card__header) {
  padding: 14px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
  font-weight: 600;
}

.section :deep(.el-card__body) {
  padding: 20px;
}

.theme-preview {
  display: inline-block;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  margin-left: 12px;
  vertical-align: middle;
  border: 1px solid var(--el-border-color);
}

.theme-hex {
  display: inline-block;
  margin-left: 8px;
  font-family: monospace;
  font-size: 13px;
  vertical-align: middle;
}

.preset-row {
  display: flex;
  gap: 8px;
}

.preset-swatch {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-swatch:hover {
  transform: scale(1.1);
}

.preset-swatch.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}
</style>
