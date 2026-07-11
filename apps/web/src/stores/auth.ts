import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { post, get } from '@/api/http';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    roles: string[];
    merchantId?: string;
  };
}

const ACCESS_KEY = 'wm_access_token';
const REFRESH_KEY = 'wm_refresh_token';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_KEY));
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY));
  const user = ref<LoginResult['user'] | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);
  const roles = computed<string[]>(() => user.value?.roles ?? []);

  async function login(username: string, password: string): Promise<void> {
    const result = await post<LoginResult>('/auth/login', { username, password });
    accessToken.value = result.accessToken;
    refreshToken.value = result.refreshToken;
    user.value = result.user;
    localStorage.setItem(ACCESS_KEY, result.accessToken);
    localStorage.setItem(REFRESH_KEY, result.refreshToken);
  }

  async function refresh(): Promise<void> {
    if (!refreshToken.value) {
      throw new Error('无刷新令牌');
    }
    const result = await post<LoginResult>('/auth/refresh', { refreshToken: refreshToken.value });
    accessToken.value = result.accessToken;
    refreshToken.value = result.refreshToken;
    user.value = result.user;
    localStorage.setItem(ACCESS_KEY, result.accessToken);
    localStorage.setItem(REFRESH_KEY, result.refreshToken);
  }

  async function logout(): Promise<void> {
    try {
      await post('/auth/logout');
    } catch {
      // 即使后端失败也清除本地
    }
    clearTokens();
  }

  async function fetchMe(): Promise<void> {
    try {
      const me = await get<LoginResult['user']>('/auth/me');
      user.value = me ?? null;
    } catch {
      clearTokens();
    }
  }

  function clearTokens(): void {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    roles,
    login,
    refresh,
    logout,
    fetchMe,
    clearTokens,
  };
});
