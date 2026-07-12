/**
 * 测试工具：创建已认证的 HTTP 客户端
 * 后端响应格式 { code, data, requestId }，自动解构出 data
 */
import axios, { AxiosRequestConfig } from 'axios';

export interface HttpClient {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  patch<T>(url: string, data?: unknown): Promise<T>;
  put<T>(url: string, data?: unknown): Promise<T>;
  delete<T>(url: string): Promise<T>;
}

export function createPublicClient(baseURL: string): HttpClient {
  const client = axios.create({ baseURL, timeout: 30000 });
  return {
    get: (url, config) => client.get(url, config).then((r) => r.data.data),
    post: (url, data, config) => client.post(url, data, config).then((r) => r.data.data),
    patch: (url, data) => client.patch(url, data).then((r) => r.data.data),
    put: (url, data) => client.put(url, data).then((r) => r.data.data),
    delete: (url) => client.delete(url).then((r) => r.data.data),
  };
}

export async function createAdminClient(baseURL: string): Promise<HttpClient> {
  const client = axios.create({ baseURL, timeout: 30000 });
  const loginRes = await client.post('/auth/login', {
    username: 'admin',
    password: 'Admin@2026',
  });
  const token = loginRes.data.data.accessToken;
  client.defaults.headers.common.Authorization = `Bearer ${token}`;

  return {
    get: (url, config) => client.get(url, config).then((r) => r.data.data),
    post: (url, data, config) => client.post(url, data, config).then((r) => r.data.data),
    patch: (url, data) => client.patch(url, data).then((r) => r.data.data),
    put: (url, data) => client.put(url, data).then((r) => r.data.data),
    delete: (url) => client.delete(url).then((r) => r.data.data),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
