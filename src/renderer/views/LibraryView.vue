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
    </header>

    <!-- Book grid -->
    <main class="lib-body">
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

      <div v-else class="books-grid">
        <BookCard
          v-for="book in store.books"
          :key="book.id"
          :book="book"
          @open="handleOpen"
          @contextmenu.prevent="onContextMenu($event, book)"
        />
      </div>
    </main>

    <!-- FAB -->
    <button v-if="store.books.length > 0" class="fab-import" @click="importBook" title="导入书籍">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>

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
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useReaderStore } from '../store/reader.js'
import BookCard from '../components/BookCard.vue'
import SearchPanel from '../components/SearchPanel.vue'
import ContextMenu from '../components/ContextMenu.vue'

const store = useReaderStore()
const router = useRouter()
const toast = inject('toast')
const loading = ref(false)
const loadingMsg = ref('正在解析...')
const searchRef = ref(null)

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
  router.push(`/reader/${book.id}`)
}

// ── Context menu ──
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const ctxBook = ref(null)
const ctxItems = [
  { key: 'delete', label: '从书架移除', danger: true }
]

function onContextMenu(e, book) {
  ctxBook.value = book
  ctxX.value = e.clientX
  ctxY.value = e.clientY
  ctxVisible.value = true
}

function onCtxAction(key) {
  if (key === 'delete' && ctxBook.value) {
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
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--titlebar-h, 0px) 28px 16px;
  padding-top: calc(var(--titlebar-h, 0px) + 12px);
  flex-shrink: 0; -webkit-app-region: drag; gap: 24px;
}
.header-left { display: flex; align-items: baseline; gap: 12px; }
.app-title { font-size: 24px; font-weight: 700; letter-spacing: -0.3px; }
.book-count { font-size: 13px; color: var(--text-secondary, #8c7a6b); }
.header-search { width: 280px; -webkit-app-region: no-drag; }

.lib-body { flex: 1; overflow-y: auto; padding: 8px 28px 32px; }
.books-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 24px; }

/* ── Empty ── */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: calc(100vh - 160px); text-align: center;
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

.fab-import {
  position: fixed; bottom: 32px; right: 32px; width: 56px; height: 56px; border-radius: 50%;
  border: none; background: var(--color-primary); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(201,107,44,0.35); z-index: 10;
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
}
.fab-import:hover { transform: scale(1.1); box-shadow: 0 8px 24px rgba(201,107,44,0.45); }

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
