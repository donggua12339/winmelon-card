import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { post, get } from '@/api/http';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  defaultRedirect?: string;
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
const MERCHANT_THEME_KEY = 'wm_merchant_theme';
const MERCHANT_NAME_KEY = 'wm_merchant_name';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_KEY));
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY));
  const user = ref<LoginResult['user'] | null>(null);
  const merchantName = ref<string | null>(localStorage.getItem(MERCHANT_NAME_KEY));
  const merchantThemeColor = ref<string | null>(localStorage.getItem(MERCHANT_THEME_KEY));

  const isAuthenticated = computed(() => !!accessToken.value);
  const roles = computed<string[]>(() => user.value?.roles ?? []);
  const defaultRedirect = computed<string>(() => {
    if (roles.value.includes('SUPER_ADMIN')) return '/admin/dashboard';
    if (roles.value.includes('MERCHANT')) return '/merchant/dashboard';
    return '/';
  });

  async function login(username: string, password: string): Promise<LoginResult> {
    const result = await post<LoginResult>('/auth/login', { username, password });
    applySession(result);
    return result;
  }

  async function refresh(): Promise<void> {
    if (!refreshToken.value) {
      throw new Error('无刷新令牌');
    }
    const result = await post<LoginResult>('/auth/refresh', { refreshToken: refreshToken.value });
    applySession(result);
  }

  /** 直接设置会话（用于代登录等场景） */
  function setSession(payload: { accessToken: string; refreshToken: string; user: LoginResult['user'] }): void {
    applySession(payload);
  }

  function applySession(payload: { accessToken: string; refreshToken: string; user: LoginResult['user'] }): void {
    accessToken.value = payload.accessToken;
    refreshToken.value = payload.refreshToken;
    user.value = payload.user;
    localStorage.setItem(ACCESS_KEY, payload.accessToken);
    localStorage.setItem(REFRESH_KEY, payload.refreshToken);
  }

  function setMerchantInfo(info: { merchantName?: string; themeColor?: string }): void {
    if (info.merchantName !== undefined) {
      merchantName.value = info.merchantName;
      localStorage.setItem(MERCHANT_NAME_KEY, info.merchantName);
    }
    if (info.themeColor !== undefined) {
      merchantThemeColor.value = info.themeColor;
      localStorage.setItem(MERCHANT_THEME_KEY, info.themeColor);
      applyThemeColor(info.themeColor);
    }
  }

  /** 实时应用到 :root CSS 变量 */
  function applyThemeColor(color: string | null): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (color) {
      root.style.setProperty('--theme-color', color);
    } else {
      root.style.removeProperty('--theme-color');
    }
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
    merchantName.value = null;
    merchantThemeColor.value = null;
    localStorage.removeItem(MERCHANT_NAME_KEY);
    localStorage.removeItem(MERCHANT_THEME_KEY);
    applyThemeColor(null);
  }

  // 初始化时如果有缓存的主题色，立即应用
  if (merchantThemeColor.value) {
    applyThemeColor(merchantThemeColor.value);
  }

  return {
    accessToken,
    refreshToken,
    user,
    merchantName,
    merchantThemeColor,
    isAuthenticated,
    roles,
    defaultRedirect,
    login,
    refresh,
    setSession,
    setMerchantInfo,
    logout,
    fetchMe,
    clearTokens,
  };
});
