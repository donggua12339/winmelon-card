<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import ThemeToggle from '@/components/ThemeToggle.vue';

const auth = useAuthStore();
const isLoggedIn = computed(() => auth.isAuthenticated);
const isMerchant = computed(() => auth.roles.includes('MERCHANT'));
const isSuperAdmin = computed(() => auth.roles.includes('SUPER_ADMIN'));
const dashboardUrl = computed(() => (isSuperAdmin.value ? '/admin/dashboard' : '/merchant/dashboard'));
</script>

<template>
  <div class="home">
    <!-- 顶部导航栏 -->
    <nav class="topnav">
      <div class="topnav-brand">
        <span class="brand-mark">WM</span>
        <span class="brand-text">WM Card</span>
      </div>
      <div class="topnav-right">
        <ThemeToggle />
        <template v-if="isLoggedIn">
          <RouterLink :to="dashboardUrl" class="btn btn-primary btn-sm">进入工作台</RouterLink>
        </template>
        <template v-else>
          <RouterLink to="/admin/login?as=merchant" class="btn btn-ghost btn-sm">商户登录</RouterLink>
          <RouterLink to="/admin/login?as=admin" class="btn btn-ghost btn-sm">平台后台</RouterLink>
        </template>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-eyebrow">
          <span class="status-dot online"></span>
          开源 · MIT 协议
        </div>
        <h1 class="hero-title">现代化发卡平台<br />为数字商品而生</h1>
        <p class="hero-subtitle">自动发卡 · 多商户入驻 · AES-256 加密 · 即买即发</p>
        <div class="hero-cta">
          <RouterLink to="/shop/main" class="btn btn-primary btn-lg">进入店铺</RouterLink>
          <RouterLink to="/query" class="btn btn-ghost btn-lg">订单查询</RouterLink>
        </div>
      </div>
    </section>

    <!-- 特性卡片 -->
    <section class="features container">
      <div class="feature-card">
        <div class="feature-icon-wrap">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <h3 class="feature-title">即时发卡</h3>
        <p class="feature-desc">支付成功秒级自动发货，AES-256-GCM 加密存储，安全无忧</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon-wrap">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <h3 class="feature-title">安全防护</h3>
        <p class="feature-desc">JWT 鉴权 + RBAC + 限流防刷 + 全操作审计日志</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon-wrap">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            ></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <h3 class="feature-title">多商户</h3>
        <p class="feature-desc">支持多商户入驻，独立店铺，路径式访问 /shop/:code</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon-wrap">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
        </div>
        <h3 class="feature-title">多支付</h3>
        <p class="feature-desc">易支付 / 微信 / 支付宝 / 模拟通道，回调验签 + 幂等</p>
      </div>
    </section>

    <!-- 商户招募 -->
    <section class="recruit-section container">
      <div class="recruit-card">
        <div class="recruit-header">
          <span class="recruit-eyebrow">FOR MERCHANTS</span>
          <h2 class="recruit-title">入驻成为商户</h2>
          <p class="recruit-subtitle">免入驻费 · 独立店铺 · 即时发卡 · 自由定价</p>
        </div>
        <div class="recruit-benefits">
          <div class="benefit-item">
            <div class="benefit-num">01</div>
            <div>
              <h4>独立店铺</h4>
              <p>专属路径 /shop/你的店铺码，自有品牌形象</p>
            </div>
          </div>
          <div class="benefit-item">
            <div class="benefit-num">02</div>
            <div>
              <h4>自由定价</h4>
              <p>商品、价格、库存全部自主管理</p>
            </div>
          </div>
          <div class="benefit-item">
            <div class="benefit-num">03</div>
            <div>
              <h4>即时发卡</h4>
              <p>支付成功秒级自动发货，7×24 无人值守</p>
            </div>
          </div>
          <div class="benefit-item">
            <div class="benefit-num">04</div>
            <div>
              <h4>数据看板</h4>
              <p>订单、销量、复购、客单价一目了然</p>
            </div>
          </div>
        </div>
        <div class="recruit-steps">
          <div class="step">
            <span class="step-num">1</span>
            <span>填写资料</span>
          </div>
          <span class="step-arrow">→</span>
          <div class="step">
            <span class="step-num">2</span>
            <span>邮箱验证</span>
          </div>
          <span class="step-arrow">→</span>
          <div class="step">
            <span class="step-num">3</span>
            <span>立即开通账号</span>
          </div>
          <span class="step-arrow">→</span>
          <div class="step">
            <span class="step-num">4</span>
            <span>上架商品开始销售</span>
          </div>
        </div>
        <RouterLink to="/merchant/apply" class="btn btn-primary btn-lg recruit-cta">立即申请入驻</RouterLink>
      </div>
    </section>

    <!-- 技术栈 -->
    <section class="stack-section container">
      <div class="stack-card">
        <h4 class="stack-title">技术栈</h4>
        <div class="tech-list">
          <span class="tech-tag">NestJS</span>
          <span class="tech-tag">Vue 3</span>
          <span class="tech-tag">Prisma</span>
          <span class="tech-tag">MySQL</span>
          <span class="tech-tag">Redis</span>
          <span class="tech-tag">TypeScript</span>
        </div>
      </div>
    </section>

    <!-- 底部 -->
    <footer class="footer">
      <template v-if="isLoggedIn">
        <RouterLink :to="dashboardUrl" class="footer-link">进入工作台</RouterLink>
        <span class="divider">·</span>
        <span class="role-tag">
          {{ isSuperAdmin ? '平台管理员' : isMerchant ? '商户' : '用户' }}
        </span>
        <span class="divider">·</span>
      </template>
      <template v-else>
        <RouterLink to="/admin/login?as=merchant" class="footer-link">商户登录</RouterLink>
        <span class="divider">·</span>
        <RouterLink to="/admin/login?as=admin" class="footer-link">平台后台</RouterLink>
        <span class="divider">·</span>
      </template>
      <a href="https://github.com/donggua12339/winmelon-card" target="_blank" class="footer-link">GitHub</a>
      <span class="divider">·</span>
      <span>WM Card © 2026</span>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--wm-bg-deep);
}

.container {
  width: 100%;
  max-width: var(--wm-container-max);
  margin: 0 auto;
  padding: 0 var(--wm-container-padding);
}

/* 顶部导航 */
.topnav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 32px;
  background: var(--wm-bg-base);
  border-bottom: 1px solid var(--wm-border-default);
}

.topnav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 15px;
  color: var(--wm-text-primary);
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--wm-radius-sm);
  background: var(--wm-gradient-primary);
  color: var(--wm-text-on-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.topnav-right {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 按钮系统 - Stripe 风格 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: var(--wm-radius-sm);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-lg {
  padding: 10px 20px;
  font-size: 15px;
}

.btn-primary {
  background: var(--wm-accent-primary);
  color: var(--wm-text-on-primary);

  &:hover {
    background: var(--wm-accent-primary-hover);
    color: var(--wm-text-on-primary);
    transform: translateY(-1px);
    box-shadow: var(--wm-shadow-primary);
  }
}

.btn-ghost {
  background: var(--wm-bg-base);
  border-color: var(--wm-border-default);
  color: var(--wm-text-primary);

  &:hover {
    border-color: var(--wm-border-hover);
    background: var(--wm-bg-hover);
  }
}

/* Hero */
.hero {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 96px 24px 64px;
  text-align: center;
}

.hero-content {
  max-width: 760px;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--wm-bg-base);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-pill);
  font-size: 12px;
  font-weight: 500;
  color: var(--wm-text-secondary);
  margin-bottom: 24px;
}

.hero-title {
  font-size: clamp(36px, 6vw, 56px);
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
  color: var(--wm-text-primary);
}

.hero-subtitle {
  font-size: clamp(15px, 2vw, 18px);
  color: var(--wm-text-secondary);
  margin: 0 0 40px;
  line-height: 1.6;
}

.hero-cta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  align-items: center;
}

/* 特性 */
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  padding-bottom: 64px;
}

.feature-card {
  padding: 24px 20px;
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-md);
  box-shadow: var(--wm-shadow-sm);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: var(--wm-border-hover);
    box-shadow: var(--wm-shadow-md);
    transform: translateY(-2px);
  }
}

.feature-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: var(--wm-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 16px;
  background: var(--wm-bg-hover);
  color: var(--wm-accent-primary);
}

.feature-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--wm-text-primary);
}

.feature-desc {
  font-size: 13px;
  color: var(--wm-text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* 商户招募 */
.recruit-section {
  padding-bottom: 64px;
}

.recruit-card {
  padding: 48px 32px;
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-lg);
  box-shadow: var(--wm-shadow-md);
  text-align: center;
}

.recruit-eyebrow {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--wm-accent-primary);
  margin-bottom: 12px;
}

.recruit-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--wm-text-primary);
  letter-spacing: -0.01em;
}

.recruit-subtitle {
  font-size: 14px;
  color: var(--wm-text-secondary);
  margin: 0 0 32px;
}

.recruit-benefits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
  text-align: left;
}

.benefit-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  background: var(--wm-bg-deep);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-md);
}

.benefit-num {
  font-family: var(--wm-font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--wm-accent-primary);
  flex-shrink: 0;
  padding-top: 2px;
}

.benefit-item h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--wm-text-primary);
}

.benefit-item p {
  font-size: 12px;
  color: var(--wm-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.recruit-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 32px;
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--wm-bg-base);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-pill);
}

.step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--wm-accent-primary);
  color: var(--wm-text-on-primary);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-arrow {
  color: var(--wm-text-tertiary);
  font-family: var(--wm-font-mono);
}

.recruit-cta {
  margin-top: 8px;
}

/* 技术栈 */
.stack-section {
  padding-bottom: 64px;
}

.stack-card {
  padding: 24px;
  background: var(--wm-bg-card);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-md);
  text-align: center;
}

.stack-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--wm-text-tertiary);
  margin: 0 0 16px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.tech-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.tech-tag {
  padding: 4px 12px;
  background: var(--wm-bg-base);
  border: 1px solid var(--wm-border-default);
  border-radius: var(--wm-radius-sm);
  font-size: 12px;
  color: var(--wm-text-secondary);
  font-family: var(--wm-font-mono);
  font-weight: 500;
}

/* 底部 */
.footer {
  padding: 24px 32px;
  text-align: center;
  color: var(--wm-text-tertiary);
  font-size: 13px;
  border-top: 1px solid var(--wm-border-default);
}

.footer a {
  color: var(--wm-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: var(--wm-accent-primary);
  }
}

.divider {
  margin: 0 8px;
  opacity: 0.5;
}

.footer-link {
  color: var(--wm-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease;
  padding: 0 4px;

  &:hover {
    color: var(--wm-accent-primary);
  }
}

.role-tag {
  display: inline-block;
  padding: 2px 10px;
  background: var(--wm-accent-primary);
  color: var(--wm-text-on-primary);
  border-radius: var(--wm-radius-sm);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

/* 响应式 */
@media (max-width: 640px) {
  .topnav {
    padding: 12px 16px;
  }
  .topnav-brand {
    font-size: 14px;
  }
  .brand-mark {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }
  .topnav-right {
    gap: 6px;
  }
  .topnav-right .btn:not(.theme-toggle) {
    padding: 6px 10px;
    font-size: 12px;
  }
  .hero {
    padding: 64px 16px 48px;
  }
  .hero-title {
    font-size: 32px;
  }
  .features {
    grid-template-columns: 1fr;
    padding: 0 16px 48px;
  }
  .recruit-section {
    padding: 0 16px 48px;
  }
  .recruit-card {
    padding: 32px 20px;
  }
  .recruit-benefits {
    grid-template-columns: 1fr;
  }
  .recruit-steps {
    gap: 6px;
    font-size: 12px;
  }
  .step {
    padding: 6px 10px;
  }
  .stack-section {
    padding: 0 16px 48px;
  }
  .footer {
    padding: 20px 16px;
    font-size: 12px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }
  .divider {
    margin: 0 4px;
  }
}

/* 防止任何子元素溢出导致横向滚动 */
.home {
  overflow-x: hidden;
}

.home > * {
  max-width: 100%;
  box-sizing: border-box;
}
</style>
