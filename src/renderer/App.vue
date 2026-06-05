<template>
  <router-view v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <Toast ref="toastRef" />
</template>

<script setup>
import { ref, provide } from 'vue'
import { watch } from 'vue'
import { useReaderStore } from './store/reader.js'
import Toast from './components/Toast.vue'

const store = useReaderStore()
const toastRef = ref(null)

// Expose toast globally via provide
provide('toast', {
  show: (msg, type, dur) => toastRef.value?.show(msg, type, dur),
  success: (msg) => toastRef.value?.show(msg, 'success'),
  error: (msg) => toastRef.value?.show(msg, 'error')
})

// Sync theme to <html> so CSS variable overrides work globally
watch(() => store.settings.theme, (theme) => {
  document.documentElement.dataset.theme = theme
}, { immediate: true })
</script>

<style>
/* ═══════════════════════════════════════════
   Design Tokens — Light (default)
   ═══════════════════════════════════════════ */
:root {
  --color-primary: #c96b2c;
  --color-primary-light: #e8925e;
  --color-primary-dark: #a0522d;
  --surface-page: #f5f0e8;
  --surface-card: #ffffff;
  --surface-overlay: rgba(0, 0, 0, 0.04);
  --surface-glass: rgba(255, 255, 255, 0.72);
  --text-primary: #2c2416;
  --text-secondary: #8c7a6b;
  --text-tertiary: #b8a99a;
  --border-light: #e8e0d5;
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.10);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;

  /* macOS traffic-light safe area */
  --titlebar-h: 0px;
}

/* ═══════════════════════════════════════════
   Dark Theme
   ═══════════════════════════════════════════ */
html[data-theme="dark"] {
  --surface-page: #1a1814;
  --surface-card: #252320;
  --surface-overlay: rgba(255, 255, 255, 0.04);
  --surface-glass: rgba(30, 28, 24, 0.85);
  --text-primary: #d4c8b0;
  --text-secondary: #9c9080;
  --text-tertiary: #6c6258;
  --border-light: #363330;
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.5);
}

/* ═══════════════════════════════════════════
   Sepia Theme
   ═══════════════════════════════════════════ */
html[data-theme="sepia"] {
  --surface-page: #f4ecd8;
  --surface-card: #faf5e8;
  --surface-overlay: rgba(139, 115, 85, 0.06);
  --surface-glass: rgba(250, 245, 232, 0.9);
  --text-primary: #5b4636;
  --text-secondary: #8b7355;
  --text-tertiary: #b8a080;
  --border-light: #e0d5c0;
  --shadow-card: 0 2px 8px rgba(139, 115, 85, 0.08);
  --shadow-elevated: 0 8px 24px rgba(139, 115, 85, 0.14);
}

/* macOS */
html[data-platform="darwin"] {
  --titlebar-h: 0px;
}

/* Windows/Linux title bar overlay */
html[data-platform="win32"],
html[data-platform="linux"] {
  --titlebar-h: 0px;
}

/* ═══════════════════════════════════════════
   Reset & Base
   ═══════════════════════════════════════════ */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  overflow: hidden;
  background: var(--surface-page);
  color: var(--text-primary);
  transition: background 0.4s;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
