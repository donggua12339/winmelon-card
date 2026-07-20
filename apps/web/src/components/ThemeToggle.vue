<script setup lang="ts">
import { useThemeStore } from '@/stores/theme';

const { theme, toggleTheme } = useThemeStore();
</script>

<template>
  <button
    class="theme-toggle"
    :class="{ 'is-bright': theme === 'bright-business' }"
    :title="theme === 'bright-business' ? '切换到暗色模式' : '切换到亮色模式'"
    :aria-label="theme === 'bright-business' ? '切换到暗色模式' : '切换到亮色模式'"
    @click="toggleTheme"
  >
    <span class="theme-icon">{{ theme === 'bright-business' ? '🌙' : '☀️' }}</span>
    <span class="theme-label">{{ theme === 'bright-business' ? '暗色' : '亮色' }}</span>
  </button>
</template>

<style scoped lang="scss">
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--wm-radius-pill);
  border: 1px solid var(--wm-border-default);
  background: var(--wm-glass-bg);
  color: var(--wm-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;

  &:hover {
    background: var(--wm-glass-bg-hover);
    border-color: var(--wm-border-hover);
    color: var(--wm-text-primary);
  }

  .theme-icon {
    font-size: 14px;
    line-height: 1;
  }

  &.is-bright {
    color: var(--wm-accent-warning);

    &:hover {
      color: var(--wm-accent-warning);
    }
  }
}
</style>
