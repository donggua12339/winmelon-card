<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { registerAuthHandlers } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const themeStore = useThemeStore();

// P1-6: http 拦截器需要从 auth store 获取 token + 通知会话状态
registerAuthHandlers({
  getToken: () => auth.getAccessToken(),
  // P1-6 修复: refresh 成功后更新内存中的 access token
  applySession: ({ accessToken, user }) => {
    auth.setSession({ accessToken, user: user as never });
  },
  onExpired: () => {
    auth.clearTokens();
    // 未登录且不在公开页则跳登录
    const publicPaths = ['/', '/admin/login', '/auth/impersonate', '/forgot-password', '/activate'];
    const currentPath = route.path;
    const isPublic = publicPaths.some((p) => currentPath === p || (p === '/activate' && currentPath.startsWith(p)));
    if (!isPublic) {
      router.replace('/admin/login');
    }
  },
});

// 同步 Element Plus dark class(EP 用 html.dark 触发暗色主题)
watch(
  () => themeStore.theme.value,
  (t) => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', t === 'aurora-dark');
  },
  { immediate: true },
);

onMounted(async () => {
  // P1-6: 页面加载时尝试用 refresh cookie 自动登录（用户无感刷新）
  // 公共页面（首页/登录/激活等）不需要
  const publicPaths = ['/', '/admin/login', '/auth/impersonate', '/forgot-password', '/activate'];
  const path = route.path;
  const needsAuth = !publicPaths.some((p) => path === p || path.startsWith(p));
  if (needsAuth) {
    const ok = await auth.bootstrapFromCookie();
    if (ok) await auth.fetchMe();
  }
});

// 引用 themeStore 以保留单例初始化（应用启动即应用主题）
void themeStore;
</script>

<template>
  <div class="app-shell">
    <RouterView />
  </div>
</template>

<style lang="scss">
@import './styles/variables.scss';
@import './styles/theme.scss';
@import './styles/glassmorphism.scss';
@import './styles/animations.scss';

html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
  font-family: var(--wm-font-sans);
  background: var(--wm-bg-deep);
  color: var(--wm-text-primary);
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
}

#app {
  position: relative;
  isolation: isolate;
}

.app-shell {
  position: relative;
  min-height: 100vh;
}
</style>
