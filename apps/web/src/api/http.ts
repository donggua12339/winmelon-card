import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';

const baseURL = import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}/api` : '/api';

export interface ApiResponse<T> {
  code: 'OK' | string;
  data: T;
  message?: string;
  requestId?: string;
}

export const axiosInstance: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true, // P1-6: 启用 cookie 携带（refresh_token）
});

let getAccessToken: () => string | null = () => null;
let onSessionExpired: () => void = () => undefined;

/** 由 stores/auth.ts 注册 */
export function registerAuthHandlers(handlers: {
  getToken: () => string | null;
  applySession: (payload: { accessToken: string; user: unknown }) => void;
  onExpired: () => void;
}): void {
  getAccessToken = handlers.getToken;
  applySession = handlers.applySession;
  onSessionExpired = handlers.onExpired;
}

let applySession: (payload: { accessToken: string; user: unknown }) => void = () => undefined;

axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// P1-6: 401 时刷新后重试（refresh cookie 自动携带）
let isRefreshing = false;
let refreshQueue: Array<(success: boolean) => void> = [];

axiosInstance.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 'OK') {
        ElMessage.error(body.message ?? '请求失败');
        return Promise.reject(new Error(body.message ?? '请求失败'));
      }
      return body.data;
    }
    return response.data;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const message = data?.message ?? error.message ?? '网络异常';
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    if (status === 401 && !originalRequest?._retried) {
      // 跳过 refresh 和 login / activate 端点自身的 401
      const url = originalRequest?.url ?? '';
      if (
        url.includes('/auth/refresh') ||
        url.includes('/auth/login') ||
        url.includes('/auth/me') ||
        url.includes('/auth/activate')
      ) {
        onSessionExpired();
        ElMessage.error('登录已过期，请重新登录');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        const result = await new Promise<boolean>((resolve) => {
          refreshQueue.push(resolve);
        });
        if (!result) {
          onSessionExpired();
          return Promise.reject(error);
        }
      } else {
        isRefreshing = true;
        const success = await tryRefresh();
        isRefreshing = false;
        refreshQueue.forEach((resolve) => resolve(success));
        refreshQueue = [];
        if (!success) {
          onSessionExpired();
          ElMessage.error('登录已过期，请重新登录');
          return Promise.reject(error);
        }
      }

      // 用新 token 重试原请求
      const newToken = getAccessToken();
      if (newToken && originalRequest) {
        originalRequest._retried = true;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      }
    }

    if (status === 401) {
      ElMessage.error('登录已过期，请重新登录');
    } else if (status === 429) {
      ElMessage.warning('请求过于频繁，请稍后再试');
    } else {
      ElMessage.error(message);
    }
    return Promise.reject(error);
  },
);

/** 调用 /auth/refresh（cookie 自动携带） */
async function tryRefresh(): Promise<boolean> {
  try {
    const resp = await axiosInstance.post<{
      accessToken: string;
      expiresIn: number;
      defaultRedirect?: string;
      user: unknown;
    }>(`${baseURL}/auth/refresh`, {}, { timeout: 10000 });
    if (resp.data?.accessToken) {
      // P1-6 修复：refresh 成功后**必须**更新 auth store 的内存 access token，
      // 否则后续重试用旧过期 token → 401 死循环
      applySession({ accessToken: resp.data.accessToken, user: resp.data.user });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return axiosInstance.get(url, config) as unknown as Promise<T>;
}

export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return axiosInstance.post(url, data, config) as unknown as Promise<T>;
}

export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return axiosInstance.put(url, data, config) as unknown as Promise<T>;
}

export function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return axiosInstance.delete(url, config) as unknown as Promise<T>;
}

export default axiosInstance;
