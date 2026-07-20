<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { FormInstance, FormRules } from 'element-plus';
import ThemeToggle from '@/components/ThemeToggle.vue';

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
  return '统一身份登录';
});

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
    <div class="login-card">
      <div class="brand">
        <div class="brand-mark">WM</div>
        <h1 class="brand-title">WM Card</h1>
        <p class="brand-subtitle">{{ titleText }}</p>
        <p class="brand-hint">{{ subText }}</p>
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
        <RouterLink to="/forgot-password" class="footer-link">忘记密码？</RouterLink>
        <span class="divider">·</span>
        <RouterLink to="/" class="footer-link">返回首页</RouterLink>
        <span class="divider">·</span>
        <ThemeToggle />
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
  background: var(--wm-bg-deep);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  box-shadow: var(--wm-shadow-md);
}

.brand {
  text-align: center;
  margin-bottom: 32px;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: var(--wm-radius-md);
  background: var(--wm-gradient-primary);
  color: var(--wm-text-on-primary);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
  color: var(--wm-text-primary);
}

.brand-subtitle {
  color: var(--wm-text-secondary);
  font-size: 14px;
  margin: 0;
  font-weight: 500;
}

.brand-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--wm-text-tertiary);
}

.mode-switch {
  display: flex;
  background: var(--wm-bg-deep);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-md);
  padding: 4px;
  margin: 0 0 24px;
}

.mode-btn {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  color: var(--wm-text-secondary);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--wm-radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mode-btn:hover {
  color: var(--wm-text-primary);
}

.mode-btn.active {
  background: var(--wm-bg-base);
  color: var(--wm-text-primary);
  box-shadow: var(--wm-shadow-sm);
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}

.footer {
  text-align: center;
  margin-top: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.divider {
  color: var(--wm-text-tertiary);
  opacity: 0.5;
}

.footer-link {
  color: var(--wm-text-secondary);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.15s ease;
}

.footer-link:hover {
  color: var(--wm-accent-primary);
}
</style>
