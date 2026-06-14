<template>
  <teleport to="body">
    <!-- Backdrop -->
    <div v-if="visible" class="toc-backdrop" @click="$emit('close')" />

    <!-- Sidebar -->
    <aside class="toc-sidebar" :class="{ open: visible }">
      <div class="toc-header">
        <div>
          <h3 class="toc-title">{{ activeTab === 'toc' ? '章节目录' : '书签' }}</h3>
          <span class="toc-count">{{ activeTab === 'toc' ? `${chapters.length} 章` : `${bookmarks.length} 个书签` }}</span>
        </div>
        <button class="toc-close" @click="$emit('close')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="toc-tabs">
        <button :class="{ active: activeTab === 'toc' }" @click="activeTab = 'toc'">目录</button>
        <button :class="{ active: activeTab === 'bookmarks' }" @click="activeTab = 'bookmarks'">书签</button>
      </div>

      <div v-if="activeTab === 'toc'" class="toc-list" ref="listRef">
        <button
          v-for="(ch, i) in chapters"
          :key="i"
          class="toc-item"
          :class="{ current: i === currentIndex }"
          @click="jump(i)"
        >
          <span class="toc-num">{{ i + 1 }}</span>
          <span class="toc-ch-title">
            {{ ch.title }}
            <em v-if="ch.content" class="toc-cache">已缓存</em>
          </span>
        </button>
      </div>

      <div v-else class="toc-list bookmark-list">
        <div v-if="bookmarks.length === 0" class="toc-empty">
          还没有书签。阅读时按 B 可以快速添加。
        </div>
        <button
          v-for="mark in bookmarks"
          :key="mark.id"
          class="bookmark-item"
          @click="jumpBookmark(mark)"
        >
          <span class="bookmark-ribbon" />
          <span class="bookmark-main">
            <strong>{{ mark.chapterTitle }}</strong>
            <em>章内 {{ mark.scrollPct }}% · {{ formatTime(mark.createdAt) }}</em>
          </span>
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
  currentIndex: { type: Number, default: 0 },
  bookmarks: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'jump', 'jump-bookmark'])
const listRef = ref(null)
const activeTab = ref('toc')

function jump(index) {
  emit('jump', index)
  emit('close')
}

function jumpBookmark(bookmark) {
  emit('jump-bookmark', bookmark)
  emit('close')
}

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

// Scroll current chapter into view when opened
watch(() => props.visible, async (v) => {
  if (v) {
    activeTab.value = 'toc'
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
  width: 340px;
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
  justify-content: space-between;
  padding: 18px 18px 12px;
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
  margin-top: 3px;
  display: block;
}
.toc-close {
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

.toc-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
}
.toc-tabs button {
  flex: 1;
  border: none;
  border-radius: 7px;
  padding: 7px 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
}
.toc-tabs button:hover { background: var(--surface-overlay); }
.toc-tabs button.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

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
.toc-cache {
  display: block;
  margin-top: 2px;
  font-style: normal;
  font-size: 10px;
  color: #2ea043;
  font-weight: 500;
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
  min-width: 0;
}
.toc-empty {
  padding: 48px 24px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.7;
}
.bookmark-list {
  padding: 10px;
}
.bookmark-item {
  width: 100%;
  border: 1px solid var(--border-light);
  background: var(--surface-card);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 11px 12px;
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  gap: 10px;
  text-align: left;
}
.bookmark-item:hover {
  background: var(--surface-overlay);
}
.bookmark-ribbon {
  width: 4px;
  border-radius: 4px;
  background: var(--color-primary);
  flex-shrink: 0;
}
.bookmark-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bookmark-main strong {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bookmark-main em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-tertiary);
}
</style>
