import { ref, watch } from 'vue';

export type Theme = 'bright-business' | 'aurora-dark';

const THEME_KEY = 'wm-theme';
let themeInstance: ReturnType<typeof createThemeStore> | null = null;

function createThemeStore() {
  // 初始化主题 - 从 localStorage 读取，默认 Stripe 亮色
  const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) as Theme | null;
  const theme = ref<Theme>(savedTheme === 'aurora-dark' ? 'aurora-dark' : 'bright-business');

  // 应用主题到 DOM
  function applyTheme(t: Theme): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', t);
  }

  // 切换主题
  function toggleTheme(): void {
    theme.value = theme.value === 'bright-business' ? 'aurora-dark' : 'bright-business';
  }

  // 设置指定主题
  function setTheme(t: Theme): void {
    theme.value = t;
  }

  // 监听主题变化，自动保存和应用
  watch(
    theme,
    (newTheme) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_KEY, newTheme);
      }
      applyTheme(newTheme);
    },
    { immediate: true },
  );

  return {
    theme,
    toggleTheme,
    setTheme,
  };
}

export function useThemeStore() {
  if (!themeInstance) {
    themeInstance = createThemeStore();
  }
  return themeInstance;
}
