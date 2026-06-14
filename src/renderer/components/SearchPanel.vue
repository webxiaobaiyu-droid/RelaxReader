<template>
  <div class="sp-wrap">
    <!-- Search bar -->
    <div class="sp-bar">
      <svg class="sp-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        ref="inputRef"
        v-model="query"
        class="sp-input"
        placeholder="搜索在线书源..."
        @keydown.escape="close"
        @keydown.enter="doSearch"
      />
      <button v-if="query" class="sp-clear" @click="query = ''; error = ''">✕</button>
      <button class="sp-go" @click="doSearch" :disabled="!query || loading">
        搜索
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="sp-drop">
      <div class="sp-loading">
        <div class="sp-spinner" />
        <p>{{ loadingMsg }}</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error && !loading" class="sp-drop">
      <div class="sp-error">{{ error }}</div>
    </div>

    <!-- Search results -->
    <div v-if="!loading && !error && searchResults.length > 0" class="sp-drop">
      <div class="sp-results-header">
        <span>找到 {{ searchResults.length }} 本书</span>
        <button class="sp-close-btn" @click="searchResults = []">✕</button>
      </div>
      <!-- Per-source status strip -->
      <div v-if="sourceMeta.length > 1" class="sp-source-strip">
        <span
          v-for="m in sourceMeta"
          :key="m.id"
          class="sp-src-chip"
          :class="{ fail: m.error }"
          :title="m.error || `${m.count} 条 · ${m.latencyMs}ms`"
        >
          {{ m.name }}
          <em v-if="!m.error">{{ m.count }}</em>
          <em v-else>×</em>
        </span>
      </div>
      <div
        v-for="(book, i) in searchResults"
        :key="i"
        class="sp-result-item"
        @click="selectBook(book)"
      >
        <div class="sp-result-cover" :style="coverStyle(book)">
          <span>{{ book.title?.charAt(0) || '?' }}</span>
        </div>
        <div class="sp-result-info">
          <div class="sp-result-title">{{ book.title }}</div>
          <div class="sp-result-meta">{{ book.author || '未知作者' }}</div>
          <div class="sp-result-source" v-if="book.sourceName">{{ book.sourceName }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['select', 'close'])

const query = ref('')
const loading = ref(false)
const loadingMsg = ref('')
const error = ref('')
const inputRef = ref(null)
const searchResults = ref([])
const sourceMeta = ref([])    // [{ id, name, count, latencyMs, error }]

const palettes = [
  ['#8b5a2b','#c97a3e'],['#3f4b8c','#6b7fd4'],['#7d3c00','#c45a1a'],
  ['#4a5899','#7b8cd0'],['#6d4c2e','#a8764a'],['#2e5a4a','#4d8c6e']
]
function coverStyle(book) {
  const idx = (book.title || '').length % palettes.length
  const [a, b] = palettes[idx]
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
}

async function doSearch() {
  const val = query.value.trim()
  if (!val) return

  loading.value = true
  error.value = ''
  searchResults.value = []
  sourceMeta.value = []
  loadingMsg.value = '正在并发搜索全部启用书源...'

  try {
    const res = await window.electronAPI?.searchSource(val)
    if (res?.success) {
      sourceMeta.value = res.meta?.sources || []
      if (Array.isArray(res.data) && res.data.length > 0) {
        searchResults.value = res.data
      } else {
        const failed = sourceMeta.value.filter(m => m.error)
        if (failed.length && failed.length === sourceMeta.value.length) {
          error.value = `所有书源都失败了：${failed[0].error}`
        } else {
          error.value = '未找到相关小说'
        }
      }
    } else {
      error.value = res?.error || '搜索失败，请稍后重试'
    }
  } catch (e) {
    error.value = '网络错误，请检查网络连接'
  } finally {
    loading.value = false
  }
}

function selectBook(book) {
  emit('select', book)
  // Don't clear results — let user add multiple books from same search
}

function close() {
  query.value = ''
  error.value = ''
  searchResults.value = []
  emit('close')
}

defineExpose({ close })
</script>

<style scoped>
.sp-wrap { position: relative; }
.sp-bar {
  display: flex; align-items: center;
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: 11px;
  padding: 0 10px;
  height: 42px; gap: 8px;
  transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  overflow: hidden;
}
.sp-bar:hover { border-color: var(--text-tertiary); }
.sp-bar:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(201,107,44,0.1);
}
.sp-icon { color: var(--text-tertiary); flex-shrink: 0; }
.sp-input {
  flex: 1; min-width: 0; border: none; outline: none;
  background: transparent;
  font-size: 13.5px; color: var(--text-primary);
  font-family: inherit;
  overflow: hidden; text-overflow: ellipsis;
}
.sp-input::placeholder { color: var(--text-tertiary); font-size: 13px; }
.sp-clear {
  width: 18px; height: 18px; border-radius: 50%;
  border: none; background: var(--border-light);
  font-size: 9px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); flex-shrink: 0;
}
.sp-go {
  padding: 6px 16px; border-radius: 8px;
  border: none; background: var(--color-primary); color: #fff;
  font-size: 12.5px; font-weight: 600; cursor: pointer;
  flex-shrink: 0; transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
}
.sp-go:hover:not(:disabled) { background: var(--color-primary-dark); }
.sp-go:disabled { opacity: 0.4; cursor: default; }

/* Dropdown */
.sp-drop {
  position: absolute; top: 44px; left: 0; right: 0;
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  max-height: 420px; overflow-y: auto;
  box-shadow: 0 12px 32px rgba(0,0,0,0.12);
  z-index: 50;
}
.sp-loading {
  display: flex; flex-direction: column; align-items: center;
  padding: 28px; gap: 10px;
}
.sp-spinner {
  width: 22px; height: 22px;
  border: 2.5px solid var(--border-light);
  border-top-color: var(--color-primary); border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.sp-loading p { font-size: 13px; color: var(--text-secondary); }

.sp-error {
  padding: 16px; font-size: 13px; color: #c62828; text-align: center;
}

/* Results */
.sp-results-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; font-size: 12px; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
}
.sp-close-btn {
  width: 20px; height: 20px; border-radius: 50%;
  border: none; background: transparent; cursor: pointer;
  font-size: 10px; color: var(--text-tertiary);
  display: flex; align-items: center; justify-content: center;
}
.sp-close-btn:hover { background: var(--surface-overlay); }

.sp-source-strip {
  display: flex; gap: 6px; flex-wrap: wrap;
  padding: 8px 14px; border-bottom: 1px solid var(--border-light);
  background: var(--surface-overlay);
}
.sp-src-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; border-radius: 10px;
  font-size: 10.5px; color: var(--text-secondary);
  background: var(--surface-card); border: 1px solid var(--border-light);
}
.sp-src-chip em {
  font-style: normal; font-weight: 700;
  color: var(--color-primary);
}
.sp-src-chip.fail { color: #cf222e; border-color: rgba(207,34,46,0.3); }
.sp-src-chip.fail em { color: #cf222e; }

.sp-result-item {
  display: flex; gap: 12px; padding: 10px 14px;
  cursor: pointer; transition: background 0.1s;
}
.sp-result-item:hover { background: var(--surface-overlay); }
.sp-result-item:last-child { border-radius: 0 0 12px 12px; }

.sp-result-cover {
  width: 40px; height: 54px; border-radius: 6px;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.8);
}
.sp-result-info { min-width: 0; flex: 1; }
.sp-result-title { font-size: 14px; font-weight: 600; }
.sp-result-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
.sp-result-source {
  font-size: 10px; color: var(--text-tertiary); margin-top: 2px;
  display: inline-block; padding: 1px 6px;
  background: var(--surface-overlay); border-radius: 4px;
}
</style>
