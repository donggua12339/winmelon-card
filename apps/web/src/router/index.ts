import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
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
    path: '/merchant/apply',
    name: 'merchant-apply',
    component: () => import('@/views/shop/MerchantApply.vue'),
  },
  {
    path: '/payment/mock-pay',
    name: 'mock-pay',
    component: () => import('@/views/shop/MockPay.vue'),
  },
  {
    path: '/payment/usdt',
    name: 'usdt-pay',
    component: () => import('@/views/shop/UsdtPay.vue'),
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
        path: 'domain',
        name: 'admin-domain',
        component: () => import('@/views/admin/ShopDomain.vue'),
      },
      {
        path: 'change-password',
        name: 'admin-change-password',
        component: () => import('@/views/admin/ChangePassword.vue'),
      },
      {
        path: 'audit-logs',
        name: 'admin-audit-logs',
        component: () => import('@/views/admin/AuditLog.vue'),
      },
      {
        path: 'stats',
        name: 'admin-stats',
        component: () => import('@/views/admin/AdvancedStats.vue'),
      },
      {
        path: 'risk',
        name: 'admin-risk',
        component: () => import('@/views/admin/RiskControl.vue'),
      },
      {
        path: 'merchant-applications',
        name: 'admin-merchant-applications',
        component: () => import('@/views/admin/MerchantApplications.vue'),
      },
      {
        path: 'api-keys',
        name: 'admin-api-keys',
        component: () => import('@/views/admin/ApiKeys.vue'),
      },
    ],
  },
  // 商户工作台（仅 MERCHANT 角色可访问）
  {
    path: '/merchant',
    name: 'merchant',
    component: () => import('@/views/merchant/MerchantLayout.vue'),
    children: [
      { path: '', redirect: '/merchant/dashboard' },
      {
        path: 'dashboard',
        name: 'merchant-dashboard',
        component: () => import('@/views/merchant/MerchantDashboard.vue'),
      },
      // 复用平台后台组件（merchantId 过滤由后端保证）
      {
        path: 'products',
        name: 'merchant-products',
        component: () => import('@/views/admin/Products.vue'),
      },
      {
        path: 'stock',
        name: 'merchant-stock',
        component: () => import('@/views/admin/Stock.vue'),
      },
      {
        path: 'orders',
        name: 'merchant-orders',
        component: () => import('@/views/admin/Orders.vue'),
      },
      {
        path: 'api-keys',
        name: 'merchant-api-keys',
        component: () => import('@/views/admin/ApiKeys.vue'),
      },
      {
        path: 'domain',
        name: 'merchant-domain',
        component: () => import('@/views/admin/ShopDomain.vue'),
      },
      {
        path: 'change-password',
        name: 'merchant-change-password',
        component: () => import('@/views/admin/ChangePassword.vue'),
      },
      {
        path: 'settings',
        name: 'merchant-settings',
        component: () => import('@/views/merchant/MerchantSettings.vue'),
      },
    ],
  },
  // 代登录消费页面（带 token 参数）
  {
    path: '/auth/impersonate',
    name: 'auth-impersonate',
    component: () => import('@/views/merchant/ImpersonateConsume.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // 公开页面（login、impersonate、首页、店铺、商品、订单查询等）直接放行
  const publicPrefixes = ['/admin/login', '/auth/impersonate', '/payment/', '/shop/', '/query'];
  const isPublic = to.path === '/' || publicPrefixes.some((p) => to.path.startsWith(p));
  if (isPublic) return true;

  // 需要登录的后台路径
  const isAdminArea = to.path.startsWith('/admin');
  const isMerchantArea = to.path.startsWith('/merchant');
  if (!isAdminArea && !isMerchantArea) return true;

  // 未登录 → 跳登录页
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

  const roles = auth.roles;
  const isSuperAdmin = roles.includes('SUPER_ADMIN');
  const isMerchant = roles.includes('MERCHANT');

  // /admin/* 仅 SUPER_ADMIN 可访问（MERCHANT 自动 alias 到 /merchant/* 同名页面）
  if (isAdminArea && !isSuperAdmin && isMerchant) {
    const aliasPath = to.path.replace(/^\/admin/, '/merchant');
    return { path: aliasPath, query: to.query, hash: to.hash };
  }
  if (isAdminArea && !isSuperAdmin) {
    ElMessage.warning('该区域仅限平台管理员访问');
    return { path: auth.defaultRedirect };
  }

  // /merchant/* MERCHANT 和 SUPER_ADMIN 均可访问（SUPER_ADMIN 用于代登录调试）
  if (isMerchantArea && !isMerchant && !isSuperAdmin) {
    ElMessage.warning('该区域仅限商户访问');
    return { path: auth.defaultRedirect };
  }

  return true;
});

export default router;
