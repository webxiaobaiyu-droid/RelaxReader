<template>
  <div class="sp-wrap">
    <!-- Search/URL bar -->
    <div class="sp-bar">
      <svg class="sp-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input
        ref="inputRef"
        v-model="query"
        class="sp-input"
        :placeholder="searchMode ? '搜索小说名...' : '粘贴小说网址...'"
        @keydown.escape="close"
        @keydown.enter="doAction"
      />
      <button v-if="query" class="sp-clear" @click="query = ''; error = ''">✕</button>
      <button class="sp-mode-btn" @click="searchMode = !searchMode" :title="searchMode ? '切换到网址导入' : '切换到搜索'">
        {{ searchMode ? '🔗' : '🔍' }}
      </button>
      <button class="sp-go" @click="doAction" :disabled="!query || loading">
        {{ searchMode ? '搜索' : '导入' }}
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
const searchMode = ref(true)  // true = search, false = URL import
const searchResults = ref([])

const palettes = [
  ['#8b5a2b','#c97a3e'],['#3f4b8c','#6b7fd4'],['#7d3c00','#c45a1a'],
  ['#4a5899','#7b8cd0'],['#6d4c2e','#a8764a'],['#2e5a4a','#4d8c6e']
]
function coverStyle(book) {
  const idx = (book.title || '').length % palettes.length
  const [a, b] = palettes[idx]
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
}

async function doAction() {
  if (searchMode.value) {
    await doSearch()
  } else {
    await doImport()
  }
}

async function doSearch() {
  const val = query.value.trim()
  if (!val) return

  loading.value = true
  error.value = ''
  searchResults.value = []
  loadingMsg.value = '正在搜索笔趣阁...'

  try {
    const res = await window.electronAPI?.searchSource(val)
    if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
      searchResults.value = res.data
    } else if (res?.success && res.data?.length === 0) {
      error.value = '未找到相关小说'
    } else {
      error.value = res?.error || '搜索失败，请稍后重试'
    }
  } catch (e) {
    error.value = '网络错误，请检查网络连接'
  } finally {
    loading.value = false
  }
}

async function doImport() {
  const val = query.value.trim()
  if (!val) return

  if (!/^https?:\/\//.test(val)) {
    error.value = '请输入完整的网址（以 http:// 或 https:// 开头）'
    return
  }

  loading.value = true
  error.value = ''
  loadingMsg.value = '正在解析页面...'

  try {
    const res = await window.electronAPI?.parseUrl(val)
    if (res?.success && res.data) {
      emit('select', { ...res.data, sourceId: 'universal' })
      query.value = ''
    } else {
      error.value = res?.error || '无法解析该页面，请确认是小说目录页'
    }
  } catch (e) {
    error.value = '网络错误，请检查网址是否正确'
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
  border-radius: 10px;
  padding: 0 8px;
  height: 38px; gap: 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
  overflow: hidden;
}
.sp-bar:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(201,107,44,0.1);
}
.sp-icon { color: var(--text-tertiary); flex-shrink: 0; }
.sp-input {
  flex: 1; min-width: 0; border: none; outline: none;
  background: transparent;
  font-size: 13px; color: var(--text-primary);
  font-family: inherit;
  overflow: hidden; text-overflow: ellipsis;
}
.sp-input::placeholder { color: var(--text-tertiary); font-size: 12px; }
.sp-clear {
  width: 18px; height: 18px; border-radius: 50%;
  border: none; background: var(--border-light);
  font-size: 9px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); flex-shrink: 0;
}
.sp-mode-btn {
  width: 24px; height: 24px; border: none; background: transparent;
  cursor: pointer; font-size: 14px; flex-shrink: 0;
  border-radius: 4px; transition: background 0.15s;
}
.sp-mode-btn:hover { background: var(--surface-overlay); }
.sp-go {
  padding: 4px 14px; border-radius: 7px;
  border: none; background: var(--color-primary); color: #fff;
  font-size: 12px; font-weight: 600; cursor: pointer;
  flex-shrink: 0; transition: opacity 0.15s;
  white-space: nowrap;
}
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
