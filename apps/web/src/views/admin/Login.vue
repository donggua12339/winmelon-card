<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { FormInstance, FormRules } from 'element-plus';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);
const form = reactive({
  username: '',
  password: '',
});

// 根据 ?as=merchant / ?as=admin 决定标题
const mode = computed<'admin' | 'merchant' | 'default'>(() => {
  const as = (route.query.as as string) ?? 'default';
  if (as === 'merchant' || as === 'admin') return as;
  return 'default';
});
const titleText = computed(() => {
  if (mode.value === 'merchant') return '商户登录';
  if (mode.value === 'admin') return '平台后台登录';
  return '管理后台';
});
const subText = computed(() => {
  if (mode.value === 'merchant') return '登录后进入商户工作台';
  if (mode.value === 'admin') return '登录后进入平台管理后台';
  return '';
});
const brandIcon = computed(() => (mode.value === 'merchant' ? '🏪' : '⚡'));

const rules: FormRules<typeof form> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 64, message: '用户名长度 3-64', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (!value) return callback(new Error('请输入密码'));
        if (value.length < 8) return callback(new Error('密码至少 8 位'));
        if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
          return callback(new Error('密码必须包含字母和数字'));
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

async function onSubmit(): Promise<void> {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const result = await auth.login(form.username, form.password);
    // 优先用 URL 中的 redirect，否则用后端返回的 defaultRedirect
    const queryRedirect = route.query.redirect as string | undefined;
    const target = queryRedirect || result.defaultRedirect || auth.defaultRedirect;
    router.replace(target);
  } finally {
    loading.value = false;
  }
}

function switchMode(target: 'admin' | 'merchant'): void {
  router.replace({ path: '/admin/login', query: { as: target } });
}
</script>

<template>
  <div class="login-page">
    <div class="glass login-card">
      <div class="brand">
        <div class="brand-icon">{{ brandIcon }}</div>
        <h1 class="brand-title"><span class="text-gradient-aurora">WM</span> Card</h1>
        <p class="brand-subtitle">{{ titleText }}</p>
        <p v-if="subText" class="brand-hint">{{ subText }}</p>
      </div>

      <!-- 模式切换 -->
      <div class="mode-switch">
        <button :class="['mode-btn', { active: mode === 'admin' || mode === 'default' }]" @click="switchMode('admin')">
          平台后台
        </button>
        <button :class="['mode-btn', { active: mode === 'merchant' }]" @click="switchMode('merchant')">商户登录</button>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="loading"
          native-type="submit"
          class="submit-btn"
          @click="onSubmit"
        >
          登 录
        </el-button>
      </el-form>

      <div class="footer">
        <RouterLink to="/forgot-password" class="forgot-link">忘记密码？</RouterLink>
        <span class="divider">·</span>
        <RouterLink to="/" class="back">← 返回首页</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 40px 32px;
  animation: fade-in-up 0.6s ease-out;
}

.brand {
  text-align: center;
  margin-bottom: 32px;
}

.brand-icon {
  font-size: 48px;
  margin-bottom: 12px;
  animation: float 4s ease-in-out infinite;
}

.brand-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 4px;
  letter-spacing: -0.02em;
}

.brand-subtitle {
  color: var(--wm-text-tertiary);
  font-size: 13px;
  margin: 0;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.brand-hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.mode-switch {
  display: flex;
  background: var(--wm-glass-bg);
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-md);
  padding: 4px;
  margin: 0 0 24px;
}

.mode-btn {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  color: var(--wm-text-secondary);
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--wm-radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  color: var(--wm-text-primary);
}

.mode-btn.active {
  background: var(--wm-gradient-primary);
  color: white;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.1em;
  margin-top: 8px;
}

.footer {
  text-align: center;
  margin-top: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.divider {
  color: var(--wm-text-tertiary);
  opacity: 0.5;
}

.forgot-link {
  color: var(--wm-text-secondary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s ease;
}

.forgot-link:hover {
  color: var(--wm-accent-cyan, #06b6d4);
}

.back {
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.3s ease;
}

.back:hover {
  color: var(--wm-accent-cyan);
}
</style>
