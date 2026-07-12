<script setup lang="ts">
import { ref, reactive } from 'vue';
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
    await auth.login(form.username, form.password);
    const redirect = (route.query.redirect as string) || '/admin/dashboard';
    router.replace(redirect);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="glass login-card">
      <div class="brand">
        <div class="brand-icon">⚡</div>
        <h1 class="brand-title"><span class="text-gradient-aurora">WM</span> Card</h1>
        <p class="brand-subtitle">管理后台</p>
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
