<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

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
        <span class="brand-icon">⚡</span>
        <span class="brand-text"><span class="text-gradient-aurora">WM</span> Card</span>
      </div>
      <div class="topnav-right">
        <template v-if="isLoggedIn">
          <RouterLink :to="dashboardUrl" class="topnav-btn topnav-btn-primary"> 进入工作台 → </RouterLink>
        </template>
        <template v-else>
          <RouterLink to="/admin/login?as=merchant" class="topnav-btn topnav-btn-merchant"> 🏪 商户登录 </RouterLink>
          <RouterLink to="/admin/login?as=admin" class="topnav-btn"> ⚙ 平台后台 </RouterLink>
        </template>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <div class="badge">
          <span class="status-dot online"></span>
          开源 · MIT 协议
        </div>
        <h1 class="title"><span class="text-gradient-aurora">WM</span> 官方虚拟卡密 <br />交易平台</h1>
        <p class="subtitle">现代化自动发卡 · 多商户入驻 · 安全加密 · 即买即发</p>
        <div class="cta">
          <RouterLink to="/shop/main" class="btn-primary">进入店铺 →</RouterLink>
          <RouterLink to="/merchant/apply" class="btn-merchant">✨ 商户入驻申请</RouterLink>
          <RouterLink to="/query" class="btn-ghost">订单查询</RouterLink>
        </div>
      </div>
    </section>

    <!-- 特性卡片 -->
    <section class="features">
      <div class="glass feature-card">
        <div class="feature-icon glow-purple">⚡</div>
        <h3>即时发卡</h3>
        <p>支付成功秒级自动发货，AES-256-GCM 加密存储，安全无忧</p>
      </div>
      <div class="glass feature-card">
        <div class="feature-icon glow-cyan">🛡️</div>
        <h3>安全防护</h3>
        <p>JWT 鉴权 + RBAC + 限流防刷 + 全操作审计日志</p>
      </div>
      <div class="glass feature-card">
        <div class="feature-icon glow-pink">📦</div>
        <h3>多商户</h3>
        <p>支持多商户入驻，独立店铺，路径式访问 /shop/:code</p>
      </div>
      <div class="glass feature-card">
        <div class="feature-icon glow-purple">💳</div>
        <h3>多支付</h3>
        <p>易支付 / 微信 / 支付宝 / 模拟通道，回调验签 + 幂等</p>
      </div>
    </section>

    <!-- 商户招募 -->
    <section class="merchant-recruit">
      <div class="glass recruit-card">
        <div class="recruit-header">
          <h2 class="recruit-title">入驻成为商户</h2>
          <p class="recruit-subtitle">免入驻费 · 独立店铺 · 即时发卡 · 自由定价</p>
        </div>
        <div class="recruit-benefits">
          <div class="benefit-item">
            <span class="benefit-icon">🏪</span>
            <div>
              <h4>独立店铺</h4>
              <p>专属路径 /shop/你的店铺码，自有品牌形象</p>
            </div>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">💰</span>
            <div>
              <h4>自由定价</h4>
              <p>商品、价格、库存全部自主管理</p>
            </div>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">🚀</span>
            <div>
              <h4>即时发卡</h4>
              <p>支付成功秒级自动发货，7×24 无人值守</p>
            </div>
          </div>
          <div class="benefit-item">
            <span class="benefit-icon">📊</span>
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
        <RouterLink to="/merchant/apply" class="btn-merchant-large">立即申请入驻 →</RouterLink>
      </div>
    </section>

    <!-- 技术栈 -->
    <section class="stack">
      <div class="glass stack-card">
        <h4>技术栈</h4>
        <div class="tech-list">
          <span>NestJS</span>
          <span>Vue 3</span>
          <span>Prisma</span>
          <span>MySQL</span>
          <span>Redis</span>
          <span>TypeScript</span>
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
        <RouterLink to="/admin/login?as=merchant" class="footer-link">🏪 商户登录</RouterLink>
        <span class="divider">·</span>
        <RouterLink to="/admin/login?as=admin" class="footer-link">⚙ 平台后台</RouterLink>
        <span class="divider">·</span>
      </template>
      <a href="https://github.com" target="_blank">GitHub</a>
      <span class="divider">·</span>
      <span>WM Card © 2026</span>
    </footer>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
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
  background: rgba(15, 17, 23, 0.7);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--wm-border-glass);
}

.topnav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
}

.topnav-brand .brand-icon {
  font-size: 22px;
}

.topnav-right {
  display: flex;
  gap: 10px;
}

.topnav-btn {
  padding: 8px 16px;
  border-radius: var(--wm-radius-md);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid var(--wm-border-glass);
  color: var(--wm-text-secondary);
  background: var(--wm-glass-bg);
}

.topnav-btn:hover {
  color: var(--wm-text-primary);
  border-color: var(--wm-border-glass-hover);
  background: var(--wm-glass-bg-hover);
}

.topnav-btn-merchant {
  color: #06b6d4;
  border-color: rgba(6, 182, 212, 0.4);
  background: rgba(6, 182, 212, 0.1);
}

.topnav-btn-merchant:hover {
  background: rgba(6, 182, 212, 0.2);
  color: #06b6d4;
}

.topnav-btn-primary {
  background: var(--wm-gradient-primary);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.topnav-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
  color: white;
}

/* Hero */
.hero {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  animation: fade-in-up 0.8s ease-out;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--wm-glass-bg);
  backdrop-filter: blur(var(--wm-glass-blur));
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-pill);
  font-size: 13px;
  color: var(--wm-text-secondary);
  margin-bottom: 24px;
}

.title {
  font-size: clamp(36px, 6vw, 64px);
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 24px;
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: clamp(15px, 2vw, 18px);
  color: var(--wm-text-secondary);
  margin: 0 0 40px;
  line-height: 1.6;
}

.cta {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-primary,
.btn-ghost {
  padding: 12px 32px;
  border-radius: var(--wm-radius-md);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  display: inline-block;
}

.btn-primary {
  background: var(--wm-gradient-primary);
  color: white;
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(124, 58, 237, 0.6);
}

.btn-ghost {
  background: var(--wm-glass-bg);
  backdrop-filter: blur(var(--wm-glass-blur));
  border: 1px solid var(--wm-border-glass);
  color: var(--wm-text-primary);
}

.btn-ghost:hover {
  background: var(--wm-glass-bg-hover);
  border-color: var(--wm-border-glass-hover);
}

.btn-merchant {
  padding: 12px 32px;
  border-radius: var(--wm-radius-md);
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.3s ease;
  display: inline-block;
  background: linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%);
  color: white;
  box-shadow: 0 8px 24px rgba(6, 182, 212, 0.4);
  border: 1px solid rgba(6, 182, 212, 0.5);
}

.btn-merchant:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(6, 182, 212, 0.6);
}

/* 商户招募 */
.merchant-recruit {
  padding: 0 24px 48px;
  max-width: 1000px;
  margin: 0 auto;
  width: 100%;
}

.recruit-card {
  padding: 40px 32px;
  text-align: center;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%);
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.recruit-title {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 8px;
  background: var(--wm-gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.recruit-subtitle {
  font-size: 15px;
  color: var(--wm-text-secondary);
  margin: 0 0 32px;
}

.recruit-benefits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
  text-align: left;
}

.benefit-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  background: var(--wm-glass-bg);
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-md);
}

.benefit-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.benefit-item h4 {
  font-size: 14px;
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
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 32px;
  font-size: 13px;
  color: var(--wm-text-secondary);
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--wm-glass-bg);
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-pill);
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--wm-gradient-primary);
  color: white;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-arrow {
  color: var(--wm-text-tertiary);
  font-family: var(--wm-font-mono);
}

.btn-merchant-large {
  display: inline-block;
  padding: 14px 40px;
  border-radius: var(--wm-radius-md);
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  background: var(--wm-gradient-primary);
  color: white;
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.4);
  transition: all 0.3s ease;
}

.btn-merchant-large:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(124, 58, 237, 0.6);
}

/* 特性 */
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  padding: 0 24px 48px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.feature-card {
  padding: 28px 24px;
  text-align: center;
  transition: all 0.4s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  border-color: var(--wm-border-glass-hover);
}

.feature-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--wm-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin: 0 auto 16px;
  background: var(--wm-glass-bg);
}

.feature-card h3 {
  font-size: 17px;
  margin: 0 0 8px;
  color: var(--wm-text-primary);
}

.feature-card p {
  font-size: 13px;
  color: var(--wm-text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* 技术栈 */
.stack {
  padding: 0 24px 48px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.stack-card {
  padding: 24px;
  text-align: center;
}

.stack-card h4 {
  font-size: 14px;
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

.tech-list span {
  padding: 4px 12px;
  background: var(--wm-glass-bg);
  border: 1px solid var(--wm-border-glass);
  border-radius: var(--wm-radius-pill);
  font-size: 13px;
  color: var(--wm-text-secondary);
  font-family: var(--wm-font-mono);
}

/* 底部 */
.footer {
  padding: 24px;
  text-align: center;
  color: var(--wm-text-tertiary);
  font-size: 13px;
}

.footer a {
  color: var(--wm-text-secondary);
  text-decoration: none;
  transition: color 0.3s ease;
}

.footer a:hover {
  color: var(--wm-accent-cyan);
}

.divider {
  margin: 0 8px;
  opacity: 0.5;
}

.footer-link {
  color: var(--wm-text-secondary);
  text-decoration: none;
  transition: color 0.3s ease;
  padding: 0 4px;
}

.footer-link:hover {
  color: var(--wm-accent-cyan);
}

.role-tag {
  display: inline-block;
  padding: 2px 10px;
  background: var(--wm-gradient-primary);
  color: white;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
}
</style>
