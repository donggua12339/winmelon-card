<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="home">
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
          <RouterLink to="/query" class="btn-ghost">订单查询</RouterLink>
          <RouterLink to="/merchant/apply" class="btn-ghost">商户入驻</RouterLink>
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
      <RouterLink to="/admin/login">管理后台</RouterLink>
      <span class="divider">·</span>
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
</style>
