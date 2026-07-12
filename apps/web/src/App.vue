<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="app-shell">
    <div class="bg-aurora" aria-hidden="true">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>
    <RouterView />
  </div>
</template>

<style>
@import './styles/variables.scss';
@import './styles/theme.scss';
@import './styles/glassmorphism.scss';
@import './styles/animations.scss';

html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
  font-family: var(--wm-font-sans);
  background: var(--wm-gradient-bg);
  color: var(--wm-text-primary);
}

#app {
  position: relative;
  isolation: isolate;
}

.app-shell {
  position: relative;
  min-height: 100vh;
}

/* 动态极光背景 */
.bg-aurora {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.5;
  animation: float 12s ease-in-out infinite;
}

.blob-1 {
  width: 600px;
  height: 600px;
  top: -200px;
  left: -150px;
  background: radial-gradient(circle, #7c3aed 0%, transparent 70%);
}

.blob-2 {
  width: 500px;
  height: 500px;
  top: 30%;
  right: -100px;
  background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
  animation-delay: -4s;
}

.blob-3 {
  width: 450px;
  height: 450px;
  bottom: -150px;
  left: 30%;
  background: radial-gradient(circle, #ec4899 0%, transparent 70%);
  animation-delay: -8s;
  opacity: 0.3;
}

/* 全局滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 选中文字 */
::selection {
  background: rgba(124, 58, 237, 0.4);
  color: #fff;
}
</style>
