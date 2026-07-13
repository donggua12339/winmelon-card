<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { post } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  const token = route.query.token as string;
  if (!token) {
    error.value = '代登录链接无效';
    loading.value = false;
    return;
  }
  try {
    const data = await post<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      defaultRedirect: string;
      user: { id: string; username: string; email: string; roles: string[]; merchantId?: string };
    }>('/auth/impersonate/consume', { token });
    auth.setSession({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    ElMessage.success(`已代登录为 ${data.user.username}`);
    router.replace(data.defaultRedirect);
  } catch (err: unknown) {
    const e = err as { message?: string };
    error.value = e?.message ?? '代登录失败';
    loading.value = false;
  }
});
</script>

<template>
  <div class="impersonate-page">
    <div v-loading="loading" class="glass card">
      <div class="icon">🔐</div>
      <h2>代登录中...</h2>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-else>正在使用代登录令牌登录商户工作台</p>
    </div>
  </div>
</template>

<style scoped>
.impersonate-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  text-align: center;
  padding: 40px 60px;
}

.icon {
  font-size: 48px;
  margin-bottom: 12px;
}

h2 {
  margin: 0 0 8px;
}

.error {
  color: var(--el-color-danger);
}
</style>
