import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ElMessage } from 'element-plus';

const baseURL = import.meta.env.VITE_API_BASE ? `${import.meta.env.VITE_API_BASE}/api` : '/api';

export interface ApiResponse<T> {
  code: 'OK' | string;
  data: T;
  message?: string;
  requestId?: string;
}

const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('wm_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// P2-6: 401 时自动 refresh + 重试（避免 access token 过期就跳登录）
let isRefreshing = false;
let refreshQueue: Array<(success: boolean) => void> = [];

http.interceptors.response.use(
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
      // 跳过 refresh 和 login 端点自身的 401
      const url = originalRequest?.url ?? '';
      if (url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/me')) {
        localStorage.removeItem('wm_access_token');
        localStorage.removeItem('wm_refresh_token');
        ElMessage.error('登录已过期，请重新登录');
        return Promise.reject(error);
      }

      // 队列等待 refresh 完成
      if (isRefreshing) {
        const result = await new Promise<boolean>((resolve) => {
          refreshQueue.push(resolve);
        });
        if (!result) return Promise.reject(error);
      } else {
        isRefreshing = true;
        const success = await tryRefresh();
        isRefreshing = false;
        // 通知队列
        refreshQueue.forEach((resolve) => resolve(success));
        refreshQueue = [];
        if (!success) {
          ElMessage.error('登录已过期，请重新登录');
          return Promise.reject(error);
        }
      }

      // 用新 token 重试原请求
      const newToken = localStorage.getItem('wm_access_token');
      if (newToken && originalRequest) {
        originalRequest._retried = true;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return http(originalRequest);
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

/** 调用 /auth/refresh，返回是否成功 */
async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('wm_refresh_token');
  if (!refreshToken) return false;
  try {
    const resp = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${baseURL}/auth/refresh`,
      { refreshToken },
      { timeout: 10000 },
    );
    const data = resp.data;
    if (data?.accessToken) {
      localStorage.setItem('wm_access_token', data.accessToken);
      if (data.refreshToken) localStorage.setItem('wm_refresh_token', data.refreshToken);
      return true;
    }
    return false;
  } catch {
    localStorage.removeItem('wm_access_token');
    localStorage.removeItem('wm_refresh_token');
    return false;
  }
}

export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return http.get(url, config) as unknown as Promise<T>;
}

export function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return http.post(url, data, config) as unknown as Promise<T>;
}

export function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return http.put(url, data, config) as unknown as Promise<T>;
}

export function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return http.delete(url, config) as unknown as Promise<T>;
}

export default http;
