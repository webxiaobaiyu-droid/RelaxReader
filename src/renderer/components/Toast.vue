<template>
  <teleport to="body">
    <div class="toast-stack">
      <transition-group name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="t.type"
        >{{ t.message }}</div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup>
import { ref } from 'vue'

const toasts = ref([])
let id = 0

function show(message, type = 'info', duration = 2500) {
  const item = { id: ++id, message, type }
  toasts.value.push(item)
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== item.id)
  }, duration)
}

defineExpose({ show })
</script>

<style scoped>
.toast-stack {
  position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
  z-index: 999; display: flex; flex-direction: column; gap: 8px;
  pointer-events: none;
}
.toast-item {
  padding: 10px 20px; border-radius: 10px;
  font-size: 13px; font-weight: 500;
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  white-space: nowrap;
}
.toast-item.success { color: #2e7d32; }
.toast-item.error { color: #c62828; }
.toast-enter-active { transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateY(12px) scale(0.95); }
.toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
