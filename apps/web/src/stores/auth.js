import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { post, get } from '@/api/http';
const ACCESS_KEY = 'wm_access_token';
const REFRESH_KEY = 'wm_refresh_token';
export const useAuthStore = defineStore('auth', () => {
    const accessToken = ref(localStorage.getItem(ACCESS_KEY));
    const refreshToken = ref(localStorage.getItem(REFRESH_KEY));
    const user = ref(null);
    const isAuthenticated = computed(() => !!accessToken.value);
    const roles = computed(() => user.value?.roles ?? []);
    async function login(username, password) {
        const result = await post('/auth/login', { username, password });
        accessToken.value = result.accessToken;
        refreshToken.value = result.refreshToken;
        user.value = result.user;
        localStorage.setItem(ACCESS_KEY, result.accessToken);
        localStorage.setItem(REFRESH_KEY, result.refreshToken);
    }
    async function refresh() {
        if (!refreshToken.value) {
            throw new Error('无刷新令牌');
        }
        const result = await post('/auth/refresh', { refreshToken: refreshToken.value });
        accessToken.value = result.accessToken;
        refreshToken.value = result.refreshToken;
        user.value = result.user;
        localStorage.setItem(ACCESS_KEY, result.accessToken);
        localStorage.setItem(REFRESH_KEY, result.refreshToken);
    }
    async function logout() {
        try {
            await post('/auth/logout');
        }
        catch {
            // 即使后端失败也清除本地
        }
        clearTokens();
    }
    async function fetchMe() {
        try {
            const me = await get('/auth/me');
            user.value = me ?? null;
        }
        catch {
            clearTokens();
        }
    }
    function clearTokens() {
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
