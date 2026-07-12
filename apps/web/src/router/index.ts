import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/shop/:merchantCode',
    name: 'shop',
    component: () => import('@/views/shop/ShopIndex.vue'),
  },
  {
    path: '/query',
    name: 'order-query',
    component: () => import('@/views/shop/OrderQuery.vue'),
  },
  {
    path: '/payment/mock-pay',
    name: 'mock-pay',
    component: () => import('@/views/shop/MockPay.vue'),
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/Login.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/admin/Layout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
      },
      {
        path: 'products',
        name: 'admin-products',
        component: () => import('@/views/admin/Products.vue'),
      },
      {
        path: 'stock',
        name: 'admin-stock',
        component: () => import('@/views/admin/Stock.vue'),
      },
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/views/admin/Orders.vue'),
      },
      {
        path: 'payments',
        name: 'admin-payments',
        component: () => import('@/views/admin/Payments.vue'),
      },
      {
        path: 'system',
        name: 'admin-system',
        component: () => import('@/views/admin/SystemConfig.vue'),
      },
      {
        path: 'audit-logs',
        name: 'admin-audit-logs',
        component: () => import('@/views/admin/AuditLog.vue'),
      },
      {
        path: 'risk',
        name: 'admin-risk',
        component: () => import('@/views/admin/RiskControl.vue'),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.path.startsWith('/admin') && to.name !== 'admin-login') {
    const auth = useAuthStore();
    if (!auth.isAuthenticated) {
      return { name: 'admin-login', query: { redirect: to.fullPath } };
    }
    // 已登录但未拉取用户信息
    if (!auth.user) {
      await auth.fetchMe();
      if (!auth.isAuthenticated) {
        return { name: 'admin-login', query: { redirect: to.fullPath } };
      }
    }
  }
  return true;
});

export default router;
