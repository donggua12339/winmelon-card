<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

interface ValidateResp {
  valid: boolean;
  email?: string;
  type?: string;
}

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const token = ref<string>((route.query.token as string) ?? '');
const password = ref('');
const confirmPassword = ref('');
const loading = ref(false);
const validating = ref(true);
const valid = ref(false);
const email = ref('');
const tokenType = ref('');

async function validateToken() {
  if (!token.value) {
    ElMessage.error('激活链接缺少 token 参数');
    validating.value = false;
    return;
  }
  try {
    const resp = await post<ValidateResp>('/auth/activate/validate', { token: token.value });
    valid.value = resp.valid;
    email.value = resp.email ?? '';
    tokenType.value = resp.type ?? '';
  } catch {
    valid.value = false;
  } finally {
    validating.value = false;
  }
}

async function submit() {
  if (password.value.length < 8) {
    ElMessage.warning('密码至少 8 位');
    return;
  }
  if (password.value !== confirmPassword.value) {
    ElMessage.warning('两次密码不一致');
    return;
  }
  loading.value = true;
  try {
    const result = await post<{
      accessToken: string;
      expiresIn: number;
      defaultRedirect: string;
      user: { id: string; username: string; email: string; roles: string[]; merchantId?: string };
    }>('/auth/activate', { token: token.value, password: password.value });
    auth.setSession({ accessToken: result.accessToken, user: result.user });
    ElMessage.success('账号激活成功！');
    // 跳到默认页（merchant dashboard 或 admin dashboard）
    const dest =
      result.defaultRedirect ??
      (result.user.roles.includes('SUPER_ADMIN') ? '/admin/dashboard' : '/merchant/dashboard');
    router.replace(dest);
  } catch {
    // http 拦截器已提示
  } finally {
    loading.value = false;
  }
}

onMounted(validateToken);
</script>

<template>
  <div class="activate-page">
    <div class="activate-container">
      <RouterLink to="/" class="back">← 返回首页</RouterLink>
      <div class="glass activate-card">
        <h1 class="title">
          <span class="text-gradient">账号激活</span>
        </h1>
        <p class="subtitle">设置您的商户账号密码</p>

        <div v-if="validating" class="loading-state">
          <el-icon class="rotating"><i-ep-loading /></el-icon>
          <span>正在验证激活链接...</span>
        </div>

        <div v-else-if="!valid" class="error-state">
          <el-alert
            type="error"
            :closable="false"
            show-icon
            title="激活链接无效或已过期"
            description="请联系管理员重新发送激活邮件。"
          />
        </div>

        <form v-else class="activate-form" @submit.prevent="submit">
          <div class="info-row">
            <div class="info-item">
              <span class="info-label">账号</span>
              <span class="info-value">{{ email }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">激活类型</span>
              <el-tag size="small">{{ tokenType === 'MERCHANT_APPROVE' ? '商户入驻' : tokenType }}</el-tag>
            </div>
          </div>

          <div class="form-row">
            <label>设置密码（至少 8 位）</label>
            <el-input
              v-model="password"
              type="password"
              placeholder="请输入密码"
              size="large"
              show-password
              autocomplete="new-password"
            />
          </div>
          <div class="form-row">
            <label>确认密码</label>
            <el-input
              v-model="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              size="large"
              show-password
              autocomplete="new-password"
            />
          </div>

          <el-button type="primary" size="large" :loading="loading" native-type="submit" class="submit-btn">
            激活账号并登录
          </el-button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activate-page {
  min-height: 100vh;
  padding: 32px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.activate-container {
  max-width: 520px;
  width: 100%;
}
.back {
  display: inline-block;
  color: var(--wm-text-tertiary);
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 16px;
}
.back:hover {
  color: var(--wm-accent-cyan);
}
.activate-card {
  padding: 40px 32px;
  animation: fade-in-up 0.6s ease-out;
}
.title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 8px;
  text-align: center;
}
.subtitle {
  color: var(--wm-text-secondary);
  font-size: 14px;
  text-align: center;
  margin: 0 0 32px;
}
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--wm-text-secondary);
}
.error-state {
  margin-top: 16px;
}
.activate-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.info-row {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: var(--wm-glass-bg);
  border-radius: var(--wm-radius-md);
}
.info-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-label {
  font-size: 12px;
  color: var(--wm-text-tertiary);
}
.info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--wm-text-primary);
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-row label {
  font-size: 13px;
  color: var(--wm-text-secondary);
  font-weight: 500;
}
.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  margin-top: 8px;
}
.rotating {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
