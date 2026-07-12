import axios from 'axios';
import { ElMessage } from 'element-plus';
const baseURL = import.meta.env.VITE_API_BASE
    ? `${import.meta.env.VITE_API_BASE}/api`
    : '/api';
const http = axios.create({
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
http.interceptors.response.use((response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'code' in body) {
        if (body.code !== 'OK') {
            ElMessage.error(body.message ?? '请求失败');
            return Promise.reject(new Error(body.message ?? '请求失败'));
        }
        return body.data;
    }
    return response.data;
}, (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const message = data?.message ?? error.message ?? '网络异常';
    if (status === 401) {
        localStorage.removeItem('wm_access_token');
        localStorage.removeItem('wm_refresh_token');
        // 不在此处自动跳转，由路由守卫处理
        ElMessage.error('登录已过期，请重新登录');
    }
    else if (status === 429) {
        ElMessage.warning('请求过于频繁，请稍后再试');
    }
    else {
        ElMessage.error(message);
    }
    return Promise.reject(error);
});
export function get(url, config) {
    return http.get(url, config);
}
export function post(url, data, config) {
    return http.post(url, data, config);
}
export function put(url, data, config) {
    return http.put(url, data, config);
}
export function del(url, config) {
    return http.delete(url, config);
}
export default http;
