import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { post, get } from '@/api/http';
import { axiosInstance } from '@/api/http';

export interface LoginResult {
  accessToken: string;
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

const MERCHANT_THEME_KEY = 'wm_merchant_theme';
const MERCHANT_NAME_KEY = 'wm_merchant_name';
const MERCHANT_CURRENT_SHOP_KEY = 'wm_merchant_current_shop';

export interface MerchantShop {
  id: string;
  code: string;
  name: string;
  isOnline: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  // P1-6: access token 内存化（页面刷新即丢失，依赖 refresh cookie 自动换新）
  const accessToken = ref<string | null>(null);
  const user = ref<LoginResult['user'] | null>(null);
  const merchantName = ref<string | null>(localStorage.getItem(MERCHANT_NAME_KEY));
  const merchantThemeColor = ref<string | null>(localStorage.getItem(MERCHANT_THEME_KEY));
  const shops = ref<MerchantShop[]>([]);
  const currentShopId = ref<string | null>(localStorage.getItem(MERCHANT_CURRENT_SHOP_KEY));

  const isAuthenticated = computed(() => !!accessToken.value);
  const roles = computed<string[]>(() => user.value?.roles ?? []);
  const defaultRedirect = computed<string>(() => {
    if (roles.value.includes('SUPER_ADMIN')) return '/admin/dashboard';
    if (roles.value.includes('MERCHANT')) return '/merchant/dashboard';
    return '/';
  });

  /** 提供给 http 拦截器用：每次请求取最新值 */
  function getAccessToken(): string | null {
    return accessToken.value;
  }

  async function login(username: string, password: string): Promise<LoginResult> {
    const result = await post<LoginResult>('/auth/login', { username, password });
    applySession(result);
    return result;
  }

  /**
   * P1-6: refresh 走 httpOnly cookie（不带 refreshToken 在 body）
   * 通过 cookie 自动发送到后端 +withCredentials
   */
  async function refresh(): Promise<void> {
    const result = await axiosInstance.post<LoginResult>('/auth/refresh', {});
    applySession(result.data);
  }

  /** 直接设置会话（用于代登录、激活等场景） */
  function setSession(payload: { accessToken: string; refreshToken?: string; user: LoginResult['user'] }): void {
    applySession(payload);
  }

  function applySession(payload: { accessToken: string; refreshToken?: string; user: LoginResult['user'] }): void {
    accessToken.value = payload.accessToken;
    user.value = payload.user;
    // refreshToken 现在走 httpOnly cookie，不需要本地存储
  }

  function setMerchantInfo(info: { merchantName?: string; themeColor?: string; shops?: MerchantShop[] }): void {
    if (info.merchantName !== undefined) {
      merchantName.value = info.merchantName;
      localStorage.setItem(MERCHANT_NAME_KEY, info.merchantName);
    }
    if (info.themeColor !== undefined) {
      merchantThemeColor.value = info.themeColor;
      localStorage.setItem(MERCHANT_THEME_KEY, info.themeColor);
      applyThemeColor(info.themeColor);
    }
    if (info.shops !== undefined) {
      shops.value = info.shops;
      // 如果当前选中的店铺不在列表里，重置为第一个（或 null）
      if (currentShopId.value && !info.shops.find((s) => s.id === currentShopId.value)) {
        setCurrentShop(info.shops[0]?.id ?? null);
      } else if (!currentShopId.value && info.shops.length > 0) {
        setCurrentShop(info.shops[0]!.id);
      }
    }
  }

  function setCurrentShop(shopId: string | null): void {
    currentShopId.value = shopId;
    if (shopId) {
      localStorage.setItem(MERCHANT_CURRENT_SHOP_KEY, shopId);
    } else {
      localStorage.removeItem(MERCHANT_CURRENT_SHOP_KEY);
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

  /**
   * P1-6: 页面加载时尝试用 refresh cookie 自动登录
   * - 失败（cookie 无效/过期）则保持未登录
   * - 后端返回 access token + user，本地有会话即可
   */
  async function bootstrapFromCookie(): Promise<boolean> {
    try {
      const result = await axiosInstance.post<LoginResult>('/auth/refresh', {});
      if (result.data.accessToken && result.data.user) {
        applySession(result.data);
        return true;
      }
    } catch {
      // 静默失败 - 用户未登录正常
    }
    return false;
  }

  async function fetchMe(): Promise<void> {
    try {
      const me = await get<LoginResult['user']>('/auth/me');
      user.value = me ?? null;
    } catch {
      // 401 时由 http 拦截器处理
    }
  }

  function clearTokens(): void {
    accessToken.value = null;
    user.value = null;
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
    user,
    merchantName,
    merchantThemeColor,
    shops,
    currentShopId,
    isAuthenticated,
    roles,
    defaultRedirect,
    getAccessToken,
    login,
    refresh,
    setSession,
    setMerchantInfo,
    setCurrentShop,
    logout,
    bootstrapFromCookie,
    fetchMe,
    clearTokens,
  };
});
