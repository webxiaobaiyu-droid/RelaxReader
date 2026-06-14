<template>
  <div class="library">
    <!-- Header -->
    <header class="lib-header">
      <div class="header-left">
        <h1 class="app-title">Relax Reader</h1>
        <span class="book-count" v-if="store.books.length">{{ store.books.length }} 本书</span>
      </div>

      <div class="header-search">
        <SearchPanel
          ref="searchRef"
          @select="onSearchSelect"
          @close="showSearch = false"
        />
      </div>

      <div class="header-actions">
        <button class="header-btn" @click="importBook" title="导入本地书籍 (Cmd+O)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
        <button
          class="header-btn"
          @click="showSources = true"
          :title="`书源管理（${enabledSources}/${totalSources} 启用）`"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span v-if="hasUnhealthySources" class="header-btn-dot" />
        </button>
      </div>
    </header>

    <!-- Book grid -->
    <main class="lib-body">
      <div v-if="store.books.length > 0" class="library-toolbar">
        <div class="filter-tabs">
          <button
            v-for="f in filters"
            :key="f.key"
            :class="{ active: activeFilter === f.key }"
            @click="activeFilter = f.key"
          >
            {{ f.label }}
            <span>{{ f.count }}</span>
          </button>
        </div>
        <select v-model="sortBy" class="sort-select" title="排序">
          <option value="recent">最近阅读</option>
          <option value="added">添加时间</option>
          <option value="progress">阅读进度</option>
          <option value="title">书名</option>
        </select>
      </div>

      <div v-if="store.books.length === 0 && !loading" class="empty-state">
        <svg class="empty-art" width="120" height="100" viewBox="0 0 120 100" fill="none">
          <rect x="10" y="5" width="42" height="58" rx="4" fill="#e0d8c8" stroke="#ccc" stroke-width="1.2"/>
          <rect x="14" y="8" width="34" height="46" rx="2" fill="#f0ebe0"/>
          <line x1="20" y1="18" x2="44" y2="18" stroke="#ccc" stroke-width="1.5"/>
          <line x1="20" y1="24" x2="40" y2="24" stroke="#ddd" stroke-width="1"/>
          <line x1="20" y1="29" x2="42" y2="29" stroke="#ddd" stroke-width="1"/>
          <rect x="62" y="16" width="44" height="54" rx="4" fill="#e0d8c8" stroke="#ccc" stroke-width="1.2"/>
          <rect x="66" y="20" width="36" height="40" rx="2" fill="#f0ebe0"/>
          <line x1="72" y1="30" x2="92" y2="30" stroke="#ccc" stroke-width="1.5"/>
          <line x1="72" y1="36" x2="88" y2="36" stroke="#ddd" stroke-width="1"/>
          <circle cx="38" cy="76" r="8" fill="#e0d8c8" stroke="#ccc" stroke-width="1"/>
          <path d="M36 76l2 3 5-5" stroke="#c96b2c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2>书架还是空的</h2>
        <p>导入本地书籍，或搜索在线书源</p>
        <div class="empty-actions">
          <button class="btn-primary" @click="importBook">导入本地书籍</button>
          <button class="btn-secondary" @click="focusSearch">搜索在线书籍</button>
        </div>
      </div>

      <div v-else-if="visibleBooks.length === 0" class="empty-state compact">
        <h2>当前筛选没有书</h2>
        <p>切换筛选条件，或继续添加新书。</p>
      </div>

      <div v-else class="books-grid">
        <BookCard
          v-for="book in visibleBooks"
          :key="book.id"
          :book="book"
          @open="handleOpen"
          @contextmenu.prevent="onContextMenu($event, book)"
        />
      </div>
    </main>

    <!-- Loading -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner" /><p>{{ loadingMsg }}</p>
    </div>

    <!-- Context menu -->
    <ContextMenu
      :visible="ctxVisible"
      :x="ctxX" :y="ctxY"
      :items="ctxItems"
      @action="onCtxAction"
      @close="ctxVisible = false"
    />

    <!-- Source manager drawer -->
    <SourceManager
      :visible="showSources"
      @close="showSources = false"
      @changed="loadSourceStats"
    />
  </div>
</template>

<script setup>
import { ref, inject, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReaderStore } from '../store/reader.js'
import BookCard from '../components/BookCard.vue'
import SearchPanel from '../components/SearchPanel.vue'
import ContextMenu from '../components/ContextMenu.vue'
import SourceManager from '../components/SourceManager.vue'

const store = useReaderStore()
const router = useRouter()
const toast = inject('toast')
const loading = ref(false)
const loadingMsg = ref('正在解析...')
const searchRef = ref(null)
const showSources = ref(false)
const activeFilter = ref('all')
const sortBy = ref('recent')

// Header source badge stats — refreshed on open and after source changes
const sourceStats = ref({ total: 0, enabled: 0, unhealthy: 0 })
const totalSources = computed(() => sourceStats.value.total)
const enabledSources = computed(() => sourceStats.value.enabled)
const hasUnhealthySources = computed(() => sourceStats.value.unhealthy > 0)
const filters = computed(() => [
  { key: 'all', label: '全部', count: store.books.length },
  { key: 'local', label: '本地', count: store.books.filter(b => b.format !== 'online').length },
  { key: 'online', label: '在线', count: store.books.filter(b => b.format === 'online').length },
  { key: 'cached', label: '已缓存', count: store.books.filter(b => (b.cachedChapters || 0) > 0).length },
  { key: 'bookmarked', label: '书签', count: store.books.filter(b => b.bookmarks?.length).length }
])
const visibleBooks = computed(() => {
  const filtered = store.books.filter(book => {
    if (activeFilter.value === 'local') return book.format !== 'online'
    if (activeFilter.value === 'online') return book.format === 'online'
    if (activeFilter.value === 'cached') return (book.cachedChapters || 0) > 0
    if (activeFilter.value === 'bookmarked') return (book.bookmarks?.length || 0) > 0
    return true
  })

  return [...filtered].sort((a, b) => {
    if (sortBy.value === 'added') return (b.addedAt || 0) - (a.addedAt || 0)
    if (sortBy.value === 'progress') return (b.progress || 0) - (a.progress || 0)
    if (sortBy.value === 'title') return (a.title || '').localeCompare(b.title || '', 'zh-CN')
    return (b.lastReadAt || 0) - (a.lastReadAt || 0)
  })
})

async function loadSourceStats() {
  const res = await window.electronAPI?.listSources()
  if (res?.success) {
    const all = res.data || []
    sourceStats.value = {
      total: all.length,
      enabled: all.filter(s => s.enabled).length,
      unhealthy: all.filter(s => s.enabled && s.health?.status === 'fail').length
    }
  }
}

onMounted(async () => {
  await Promise.all([loadSourceStats(), store.loadCacheStats()])
  refreshMissingCovers()
})

async function refreshMissingCovers() {
  const targets = store.books.filter(b => b.format === 'online' && !b.cover && b.bookUrl)
  for (const book of targets) {
    try {
      const res = book.sourceId === 'universal'
        ? await window.electronAPI?.parseUrl(book.bookUrl)
        : await window.electronAPI?.fetchSourceBook(book.sourceId, book.bookUrl)
      if (res?.success && res.data?.cover) {
        book.cover = res.data.cover
      }
    } catch {}
  }
}

// ── Local import ──
async function importBook() {
  const filePath = await window.electronAPI?.openFileDialog({
    filters: [{ name: '电子书', extensions: ['txt', 'epub'] }]
  })
  if (!filePath) return
  loading.value = true
  loadingMsg.value = '正在解析书籍...'
  try {
    const result = await window.electronAPI?.parseBook(filePath)
    if (result?.success && result.data) {
      store.addBook(result.data)
      toast?.success('已添加到书架')
    } else {
      toast?.error(result?.error || '解析失败')
    }
  } catch (e) {
    toast?.error('导入出错')
  } finally {
    loading.value = false
  }
}

function bookId(url) {
  // Use the path part of the URL for a unique ID
  try {
    const u = new URL(url)
    return btoa(u.pathname).replace(/=/g, '').slice(0, 12)
  } catch {
    return btoa(url).replace(/=/g, '').slice(-12)
  }
}

// ── URL import / catalog / search result → add ──
async function onSearchSelect(book) {
  // Source search result: fetch chapters from source
  if (book.sourceId && book.sourceId !== 'catalog' && book.sourceId !== 'universal' && book.bookUrl) {
    const id = bookId(book.bookUrl)
    // Check duplicate
    if (store.books.find(b => b.id === id)) {
      toast?.show(`《${book.title}》已在书架中`)
      return
    }
    loading.value = true
    loadingMsg.value = `正在获取《${book.title}》章节列表...`
    try {
      const res = await window.electronAPI?.fetchSourceBook(book.sourceId, book.bookUrl)
      if (res?.success && res.data) {
        const chapters = (res.data.chapters || []).map((ch, i) => ({
          index: i, title: ch.title, url: ch.url, content: ''
        }))
        store.addBook({
          id, title: res.data.title || book.title, author: res.data.author || book.author,
          cover: res.data.cover || book.cover,
          filePath: null, format: 'online',
          totalChapters: chapters.length, chapters,
          addedAt: Date.now(), lastReadAt: null, progress: 0,
          sourceId: book.sourceId, bookUrl: book.bookUrl
        })
        toast?.success(`《${book.title}》已添加（${chapters.length}章）`)
      } else {
        toast?.error(res?.error || '获取章节失败')
      }
    } catch (e) {
      toast?.error('获取章节出错')
    } finally {
      loading.value = false
    }
    return
  }

  // URL import: chapters already parsed from the page
  const id = book.bookUrl ? bookId(book.bookUrl) : btoa(book.title).replace(/=/g, '').slice(-12)
  if (store.books.find(b => b.id === id)) {
    toast?.show(`《${book.title}》已在书架中`)
    return
  }
  loading.value = true
  loadingMsg.value = `正在获取《${book.title}》...`
  try {
    const chapters = (book.chapters || []).map((ch, i) => ({
      index: i, title: ch.title, url: ch.url, content: ''
    }))
    store.addBook({
      id, title: book.title, author: book.author, cover: book.cover,
      filePath: null, format: 'online',
      totalChapters: chapters.length, chapters,
      addedAt: Date.now(), lastReadAt: null, progress: 0,
      sourceId: book.sourceId, bookUrl: book.bookUrl
    })
    toast?.success(`《${book.title}》已添加（${chapters.length}章）`)
  } catch (e) {
    toast?.error('导入失败')
  } finally {
    loading.value = false
  }
}

function focusSearch() {
  searchRef.value?.$el?.querySelector('input')?.focus()
}

// ── Open book ──
function handleOpen(book) {
  book.lastReadAt = Date.now()
  router.push(`/reader/${book.id}`)
}

// ── Context menu ──
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const ctxBook = ref(null)
const ctxItems = computed(() => {
  const items = [{ key: 'open', label: '继续阅读' }]
  if ((ctxBook.value?.cachedChapters || 0) > 0) {
    items.push({ key: 'clear-cache', label: '清除本书缓存' })
  }
  items.push({ key: 'delete', label: '从书架移除', danger: true })
  return items
})

function onContextMenu(e, book) {
  ctxBook.value = book
  ctxX.value = e.clientX
  ctxY.value = e.clientY
  ctxVisible.value = true
}

async function onCtxAction(key) {
  if (!ctxBook.value) return
  if (key === 'open') {
    handleOpen(ctxBook.value)
  }
  if (key === 'clear-cache') {
    const res = await store.clearBookCache(ctxBook.value.id)
    if (res?.success) toast?.success('已清除本书缓存')
    else toast?.error(res?.error || '清除缓存失败')
  }
  if (key === 'delete') {
    store.removeBook(ctxBook.value.id)
    toast?.success('已从书架移除')
  }
}
</script>

<style scoped>
.library {
  height: 100vh; display: flex; flex-direction: column;
  background: var(--surface-page, #f5f0e8); color: var(--text-primary, #333);
  transition: background 0.3s, color 0.3s;
}

.lib-header {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 420px) auto;
  align-items: center;
  column-gap: 32px;
  padding: calc(var(--titlebar-h, 0px) + 18px) 32px 18px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.app-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 1.2;
}
.book-count {
  font-size: 12px;
  color: var(--text-secondary, #8c7a6b);
  font-weight: 500;
}

.header-search {
  -webkit-app-region: no-drag;
  justify-self: end;
  width: 100%;
}

.header-actions {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 6px;
  padding: 3px;
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: 11px;
}
.header-btn {
  position: relative;
  width: 34px; height: 34px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.12s;
}
.header-btn:hover {
  background: var(--surface-overlay);
  color: var(--color-primary);
}
.header-btn:active { transform: scale(0.92); }
.header-btn-dot {
  position: absolute; top: 6px; right: 6px;
  width: 7px; height: 7px; border-radius: 50%;
  background: #cf222e;
  box-shadow: 0 0 0 2px var(--surface-card);
}

/* Smaller viewports — drop the search width and stack tighter */
@media (max-width: 880px) {
  .lib-header {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "left  actions"
      "search search";
    row-gap: 12px;
  }
  .header-left   { grid-area: left; }
  .header-actions{ grid-area: actions; }
  .header-search { grid-area: search; justify-self: stretch; }
}

.lib-body { flex: 1; overflow-y: auto; padding: 8px 32px 40px; }
.library-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  -webkit-app-region: no-drag;
}
.filter-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--surface-card);
  overflow-x: auto;
}
.filter-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: max-content;
  border: none;
  border-radius: 7px;
  padding: 7px 11px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.filter-tabs button:hover { background: var(--surface-overlay); color: var(--text-primary); }
.filter-tabs button.active {
  color: #fff;
  background: var(--color-primary);
}
.filter-tabs span {
  font-size: 10px;
  opacity: 0.8;
}
.sort-select {
  height: 34px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  padding: 0 10px;
  font-size: 12px;
  outline: none;
}
.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 28px 24px;
}

/* ── Empty ── */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: calc(100vh - 160px); text-align: center;
}
.empty-state.compact {
  height: 45vh;
}
.empty-art { margin-bottom: 20px; opacity: 0.6; }
.empty-state h2 { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
.empty-state p { font-size: 14px; color: var(--text-secondary); margin-bottom: 24px; }
.empty-actions { display: flex; gap: 12px; }

.btn-primary, .btn-secondary {
  padding: 10px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s;
}
.btn-primary {
  background: var(--color-primary, #c96b2c); color: #fff; border: none;
  box-shadow: 0 2px 8px rgba(201, 107, 44, 0.3);
}
.btn-primary:hover { transform: scale(1.04); box-shadow: 0 4px 16px rgba(201,107,44,0.4); }
.btn-secondary {
  background: transparent; color: var(--text-primary); border: 1.5px solid var(--border-light);
}
.btn-secondary:hover { border-color: var(--color-primary); color: var(--color-primary); }

.loading-overlay {
  position: fixed; inset: 0; background: rgba(245,240,232,0.8); backdrop-filter: blur(4px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; z-index: 100;
}
.spinner {
  width: 32px; height: 32px; border: 3px solid rgba(201,107,44,0.2);
  border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-overlay p { font-size: 14px; color: var(--text-secondary); }
</style>
