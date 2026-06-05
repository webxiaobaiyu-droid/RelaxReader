<template>
  <teleport to="body">
    <!-- Backdrop -->
    <div v-if="visible" class="toc-backdrop" @click="$emit('close')" />

    <!-- Sidebar -->
    <aside class="toc-sidebar" :class="{ open: visible }">
      <div class="toc-header">
        <h3 class="toc-title">目录</h3>
        <span class="toc-count">{{ chapters.length }} 章</span>
        <button class="toc-close" @click="$emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="toc-list" ref="listRef">
        <button
          v-for="(ch, i) in chapters"
          :key="i"
          class="toc-item"
          :class="{ current: i === currentIndex }"
          @click="jump(i)"
        >
          <span class="toc-num">{{ i + 1 }}</span>
          <span class="toc-ch-title">{{ ch.title }}</span>
        </button>
      </div>
    </aside>
  </teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  chapters: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['close', 'jump'])
const listRef = ref(null)

function jump(index) {
  emit('jump', index)
  emit('close')
}

// Scroll current chapter into view when opened
watch(() => props.visible, async (v) => {
  if (v) {
    await nextTick()
    const el = listRef.value?.querySelector('.toc-item.current')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
})
</script>

<style scoped>
.toc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 90;
  transition: opacity 0.25s;
}
.toc-sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 280px;
  max-width: 85vw;
  background: var(--surface-card);
  border-right: 1px solid var(--border-light);
  z-index: 91;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 4px 0 24px rgba(0,0,0,0.08);
}
.toc-sidebar.open {
  transform: translateX(0);
}

/* ── Header ── */
.toc-header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-light);
  gap: 8px;
}
.toc-title {
  font-size: 16px;
  font-weight: 700;
}
.toc-count {
  font-size: 12px;
  color: var(--text-tertiary);
}
.toc-close {
  margin-left: auto;
  width: 28px; height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  opacity: 0.5;
}
.toc-close:hover { opacity: 1; background: var(--surface-overlay); }

/* ── List ── */
.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.toc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: var(--text-primary);
  transition: background 0.1s;
}
.toc-item:hover {
  background: var(--surface-overlay);
}
.toc-item.current {
  background: rgba(201,107,44,0.08);
  color: var(--color-primary);
  font-weight: 600;
}
.toc-num {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--surface-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  color: var(--text-tertiary);
}
.toc-item.current .toc-num {
  background: rgba(201,107,44,0.15);
  color: var(--color-primary);
}
.toc-ch-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
