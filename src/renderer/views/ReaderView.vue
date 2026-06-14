<template>
  <div
    class="reader"
    :data-mode="store.settings.readingMode"
    @mousemove="onMouseMove"
    @mouseleave="showUI = false"
  >
    <!-- ═══ Auto-hiding header ═══ -->
    <header class="r-header" :class="{ visible: showUI }">
      <button class="r-hdr-btn" @click="backToLibrary" title="返回书架 (Esc)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="r-hdr-btn" @click="showToc = true" title="目录 (T)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
      <span class="chapter-label">{{ store.currentChapter?.title || store.currentBook?.title }}</span>
      <button class="r-hdr-btn" @click="toggleAutoScroll" :title="autoScrolling ? '停止滚动' : '自动滚动'">
        <svg v-if="!autoScrolling" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      </button>
      <button class="r-hdr-btn" :class="{ active: isBookmarked }" @click="toggleBookmark" :title="isBookmarked ? '取消书签 (B)' : '添加书签 (B)'">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
      <button class="r-hdr-btn" @click="showSettings = true" title="设置 (S)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><text x="4" y="21" font-size="20" font-weight="700" fill="currentColor" stroke="none">A</text></svg>
      </button>
    </header>

    <!-- ═══ Content area with click zones ═══ -->
    <main
      class="r-body"
      ref="bodyRef"
      :class="bodyClasses"
      @scroll="onScroll"
      @click="handleContentClick"
    >
      <!-- Loading -->
      <div v-if="loading" class="r-loading-wrap"><SkeletonText :lines="14" /></div>

      <!-- Scroll mode -->
      <div
        v-else-if="store.currentChapter && store.settings.readingMode === 'scroll'"
        class="r-content"
        :key="store.currentChapterIndex"
        :style="readerStyle"
      >
        <h2 class="chapter-heading">{{ store.currentChapter.title }}</h2>
        <div class="chapter-text" v-html="renderedContent" />
      </div>

      <!-- Slide mode (left/right pages) -->
      <div
        v-else-if="store.currentChapter && store.settings.readingMode === 'slide'"
        class="r-slide-container"
        ref="slideRef"
        @touchstart="onSlideTouchStart"
        @touchmove="onSlideTouchMove"
        @touchend="onSlideTouchEnd"
        @mousedown="onSlideMouseDown"
      >
        <div class="r-slide-wrapper" :style="slideWrapperStyle">
          <div class="r-slide-page" :style="readerStyle">
            <h2 class="chapter-heading">{{ store.currentChapter.title }}</h2>
            <div class="chapter-text" v-html="renderedContent" />
          </div>
        </div>
        <div class="slide-page-indicator">{{ currentPage + 1 }} / {{ totalPages }}</div>
      </div>

      <!-- Paged mode -->
      <div
        v-else-if="store.currentChapter && store.settings.readingMode === 'paged'"
        class="r-paged-wrap"
      >
        <div class="r-paged-page" :style="pagedStyle" ref="pageRef">
          <h2 class="chapter-heading">{{ store.currentChapter.title }}</h2>
          <div class="chapter-text" v-html="renderedContent" />
        </div>
      </div>

      <!-- No content -->
      <div v-else class="r-loading"><p>无法加载章节内容</p></div>
    </main>

    <!-- ═══ Footer ═══ -->
    <footer class="r-footer" :class="{ visible: showUI }">
      <span class="chap-indicator">{{ store.currentChapterIndex + 1 }} / {{ store.totalChapters }}</span>
      <div class="progress-track" @click="seekProgress" ref="progressRef">
        <div class="progress-fill" :style="{ width: store.progressPercent + '%' }" />
      </div>
      <span class="progress-pct">{{ store.progressPercent }}%</span>
      <span class="cache-state" :class="cacheState">{{ cacheStateLabel }}</span>
      <span class="time-est" v-if="timeEstimate">≈{{ timeEstimate }}</span>
    </footer>

    <!-- ═══ TOC Sidebar ═══ -->
    <ChapterTOC
      :visible="showToc"
      :chapters="store.currentBook?.chapters ?? []"
      :currentIndex="store.currentChapterIndex"
      :bookmarks="store.currentBook?.bookmarks ?? []"
      @close="showToc = false"
      @jump="jumpToChapter"
      @jump-bookmark="jumpToBookmark"
    />

    <!-- ═══ Settings ═══ -->
    <ReadingSettings :visible="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useReaderStore } from '../store/reader.js'
import ChapterTOC from '../components/ChapterTOC.vue'
import ReadingSettings from '../components/ReadingSettings.vue'
import SkeletonText from '../components/SkeletonText.vue'

const props = defineProps({ bookId: { type: String, required: true } })
const store = useReaderStore()
const router = useRouter()

const bodyRef = ref(null)
const pageRef = ref(null)
const slideRef = ref(null)
const progressRef = ref(null)
const showUI = ref(false)
const showToc = ref(false)
const showSettings = ref(false)
const loading = ref(false)
const cacheState = ref('idle')
const scrollPercent = ref(0)
const autoScrolling = ref(false)
const currentPage = ref(0)

// ── Font map ──
const fontMap = {
  default: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Noto Serif SC", "Songti SC", Georgia, serif',
  sans: '"Noto Sans SC", "PingFang SC", sans-serif'
}

// ── Styles ──
const readerStyle = computed(() => ({
  fontSize: store.settings.fontSize + 'px',
  lineHeight: store.settings.lineHeight,
  fontFamily: fontMap[store.settings.fontFamily] || fontMap.default,
  maxWidth: store.settings.pageWidth + 'px',
  padding: `0 ${store.settings.marginH}px`
}))

const pagedStyle = computed(() => ({
  ...readerStyle.value,
  padding: `0 ${store.settings.marginH}px`
}))

const bodyClasses = computed(() => ({
  paged: store.settings.readingMode === 'paged',
  slide: store.settings.readingMode === 'slide'
}))

// ── Slide mode ──
const slideOffset = ref(0)
const slideDragging = ref(false)
const totalPages = computed(() => {
  if (!slideRef.value) return 1
  return Math.max(1, Math.ceil(slideRef.value.scrollHeight / slideRef.value.clientHeight))
})

const slideWrapperStyle = computed(() => ({
  transform: `translateY(${slideOffset.value}px)`,
  transition: slideDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
}))

let slideStartY = 0
let slideStartOffset = 0

function onSlideTouchStart(e) {
  slideDragging.value = true
  slideStartY = e.touches[0].clientY
  slideStartOffset = slideOffset.value
}

function onSlideTouchMove(e) {
  if (!slideDragging.value) return
  const diff = e.touches[0].clientY - slideStartY
  slideOffset.value = slideStartOffset + diff
}

function onSlideTouchEnd(e) {
  slideDragging.value = false
  const diff = slideOffset.value - slideStartOffset
  const threshold = window.innerHeight * 0.15
  if (diff < -threshold) slideNextPage()
  else if (diff > threshold) slidePrevPage()
  else slideOffset.value = slideStartOffset
}

function onSlideMouseDown(e) {
  slideDragging.value = true
  slideStartY = e.clientY
  slideStartOffset = slideOffset.value
  const onMove = (ev) => {
    if (!slideDragging.value) return
    slideOffset.value = slideStartOffset + (ev.clientY - slideStartY)
  }
  const onUp = () => {
    slideDragging.value = false
    const diff = slideOffset.value - slideStartOffset
    const threshold = window.innerHeight * 0.15
    if (diff < -threshold) slideNextPage()
    else if (diff > threshold) slidePrevPage()
    else slideOffset.value = slideStartOffset
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function slideNextPage() {
  if (!slideRef.value) return
  const maxPage = Math.ceil(slideRef.value.scrollHeight / slideRef.value.clientHeight) - 1
  if (currentPage.value < maxPage) {
    currentPage.value++
    slideOffset.value = -currentPage.value * window.innerHeight
  } else if (store.currentChapterIndex < store.totalChapters - 1) {
    currentPage.value = 0
    slideOffset.value = 0
    nextChapter()
  }
}

function slidePrevPage() {
  if (currentPage.value > 0) {
    currentPage.value--
    slideOffset.value = -currentPage.value * window.innerHeight
  } else if (store.currentChapterIndex > 0) {
    prevChapter()
  }
}

// ── Rendered content ──
const renderedContent = computed(() => {
  const text = store.currentChapter?.content ?? ''
  if (!text) return ''
  return text.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('')
})

const isBookmarked = computed(() => store.isCurrentBookmarked())
const cacheStateLabel = computed(() => {
  if (cacheState.value === 'cached') return '已缓存'
  if (cacheState.value === 'network') return '已联网更新'
  if (cacheState.value === 'loading') return '加载中'
  return ''
})

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── Click zones (standard: top 15% = menu, left 30% = prev, right 30% = next, center 40% = menu) ──
function handleContentClick(e) {
  // Don't handle if clicking on interactive elements
  if (e.target.closest('button, a, input')) return

  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  // Top 15% = menu
  if (y < 0.15) { showUI.value = !showUI.value; return }

  // Bottom 10% = menu
  if (y > 0.9) { showUI.value = !showUI.value; return }

  const mode = store.settings.readingMode

  // Left 30% = prev
  if (x < 0.3) {
    if (mode === 'slide') slidePrevPage()
    else if (mode === 'paged') pagedPrevPage()
    else prevChapter()
    return
  }

  // Right 30% = next
  if (x > 0.7) {
    if (mode === 'slide') slideNextPage()
    else if (mode === 'paged') pagedNextPage()
    else nextChapter()
    return
  }

  // Center 40% = toggle menu
  showUI.value = !showUI.value
}

// ── Paged mode ──
function pagedNextPage() {
  if (!pageRef.value) return
  const maxPage = Math.ceil(pageRef.value.scrollHeight / pageRef.value.clientHeight) - 1
  if (currentPage.value < maxPage) {
    currentPage.value++
    pageRef.value.scrollTop = currentPage.value * pageRef.value.clientHeight
  } else if (store.currentChapterIndex < store.totalChapters - 1) {
    currentPage.value = 0
    nextChapter()
  }
}

function pagedPrevPage() {
  if (!pageRef.value) return
  if (currentPage.value > 0) {
    currentPage.value--
    pageRef.value.scrollTop = currentPage.value * pageRef.value.clientHeight
  } else if (store.currentChapterIndex > 0) {
    prevChapter()
  }
}

// ── Load book ──
onMounted(async () => {
  const bookMeta = store.books.find(b => b.id === props.bookId)
  if (!bookMeta) { router.replace('/'); return }
  loading.value = true
  try {
    await store.openBook(bookMeta)
    await loadCurrentChapterContent()
  } finally {
    loading.value = false
  }
  await restoreScrollPosition(store.scrollPosition)
})

// ── Chapter nav ──
async function navigateChapter(index) {
  if (index < 0 || index >= store.totalChapters) return
  flushReadingPosition()
  store.goToChapter(index)
  loading.value = true
  await loadCurrentChapterContent()
  loading.value = false
  await nextTick()
  currentPage.value = 0
  slideOffset.value = 0
  bodyRef.value?.scrollTo(0, 0)
}
function prevChapter() { navigateChapter(store.currentChapterIndex - 1) }
function nextChapter() { navigateChapter(store.currentChapterIndex + 1) }
function jumpToChapter(index) { navigateChapter(index) }
async function jumpToBookmark(bookmark) {
  await navigateChapter(bookmark.chapterIndex)
  await nextTick()
  const maxScroll = bodyRef.value ? bodyRef.value.scrollHeight - bodyRef.value.clientHeight : 0
  if (bodyRef.value && maxScroll > 0) {
    bodyRef.value.scrollTop = (bookmark.scrollPct / 100) * maxScroll
    store.updateProgress(bookmark.scrollPct)
  }
}

async function loadCurrentChapterContent() {
  const ch = store.currentChapter
  const book = store.currentBook
  if (!ch || !book) return
  cacheState.value = ch.content ? 'idle' : 'loading'
  if (ch.content) return
  if (!(book.format === 'online' || book.sourceId === 'universal')) return

  try {
    const cached = await window.electronAPI?.getChapterCache(book.id, ch.index ?? store.currentChapterIndex)
    if (cached?.success && cached.data?.content) {
      ch.content = cached.data.content
      cacheState.value = 'cached'
      return
    }
  } catch {}

  try {
    const res = book.sourceId === 'universal'
      ? await window.electronAPI?.fetchContent(ch.url)
      : await window.electronAPI?.fetchSourceChapter(book.sourceId, ch.url)
    if (res?.success && res.data) {
      ch.content = res.data
      cacheState.value = 'network'
      await window.electronAPI?.saveChapterCache({
        bookId: book.id,
        chapterIndex: ch.index ?? store.currentChapterIndex,
        chapterTitle: ch.title,
        content: res.data,
        sourceId: book.sourceId,
        chapterUrl: ch.url
      })
      await store.loadCacheStats()
    }
  } catch {
    cacheState.value = 'idle'
  }
}

// ── Preload ──
async function preloadNext() {
  const next = store.currentBook?.chapters?.[store.currentChapterIndex + 1]
  if (next?.url && !next.content && (store.currentBook?.format === 'online' || store.currentBook?.sourceId === 'universal')) {
    try {
      const res = store.currentBook.sourceId === 'universal'
        ? await window.electronAPI?.fetchContent(next.url)
        : await window.electronAPI?.fetchSourceChapter(store.currentBook.sourceId, next.url)
      if (res?.success) {
        next.content = res.data
        await window.electronAPI?.saveChapterCache({
          bookId: store.currentBook.id,
          chapterIndex: next.index ?? store.currentChapterIndex + 1,
          chapterTitle: next.title,
          content: res.data,
          sourceId: store.currentBook.sourceId,
          chapterUrl: next.url
        })
        await store.loadCacheStats()
      }
    } catch {}
  }
}

// ── Time estimate ──
const timeEstimate = computed(() => {
  const ch = store.currentChapter
  if (!ch?.content) return ''
  const mins = Math.ceil(ch.content.length / 400)
  if (mins < 1) return '不到1分钟'
  if (mins >= 60) return `${Math.floor(mins / 60)}小时${mins % 60}分钟`
  return `${mins}分钟`
})

// ── Keyboard ──
function onKeydown(e) {
  if (showSettings.value || showToc.value) return
  const mode = store.settings.readingMode

  // Arrow keys for slide/paged mode
  if (mode === 'slide' || mode === 'paged') {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); mode === 'slide' ? slidePrevPage() : pagedPrevPage(); return }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); mode === 'slide' ? slideNextPage() : pagedNextPage(); return }
  }

  // Page keys for all modes
  if (e.key === 'PageUp') { e.preventDefault(); prevChapter(); return }
  if (e.key === 'PageDown') { e.preventDefault(); nextChapter(); return }

  // Shortcuts
  if (e.key === 'Escape') { backToLibrary(); return }
  if (e.key === 't' || e.key === 'T') { showToc.value = !showToc.value; return }
  if (e.key === 's' || e.key === 'S') { showSettings.value = !showSettings.value; return }
  if (e.key === 'b' || e.key === 'B') { toggleBookmark(); return }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── Scroll tracking ──
let scrollTimer = null
let preloaded = false
function onScroll() {
  if (!bodyRef.value || store.settings.readingMode !== 'scroll') return
  const { scrollTop, scrollHeight, clientHeight } = bodyRef.value
  const pct = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) || 0
  scrollPercent.value = pct
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => store.updateProgress(pct), 300)
  if (pct > 80 && !preloaded) { preloaded = true; preloadNext() }
}
watch(() => store.currentChapterIndex, () => { preloaded = false; currentPage.value = 0; slideOffset.value = 0 })

// ── Progress bar seek ──
function seekProgress(e) {
  if (!bodyRef.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  bodyRef.value.scrollTop = ratio * (bodyRef.value.scrollHeight - bodyRef.value.clientHeight)
}

function toggleBookmark() {
  if (bodyRef.value && store.settings.readingMode === 'scroll') {
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.value
    const pct = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) || 0
    scrollPercent.value = pct
  }
  store.updateProgress(scrollPercent.value)
  store.toggleBookmark()
}

// ── Auto scroll ──
let autoScrollTimer = null
function toggleAutoScroll() {
  autoScrolling.value = !autoScrolling.value
  if (autoScrolling.value) {
    autoScrollTimer = setInterval(() => {
      if (bodyRef.value) bodyRef.value.scrollTop += 1
    }, 50)
  } else {
    clearInterval(autoScrollTimer)
  }
}

// ── UI auto-hide ──
let hideTimer = null
function onMouseMove() {
  showUI.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { showUI.value = false }, 3000)
}

onUnmounted(() => {
  flushReadingPosition()
  clearInterval(autoScrollTimer)
  clearTimeout(hideTimer)
  clearTimeout(scrollTimer)
})

function currentScrollPct() {
  if (store.settings.readingMode === 'scroll' && bodyRef.value) {
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.value
    return Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) || 0
  }
  if ((store.settings.readingMode === 'paged' || store.settings.readingMode === 'slide') && totalPages.value > 1) {
    return Math.round((currentPage.value / Math.max(1, totalPages.value - 1)) * 100)
  }
  return scrollPercent.value
}

function flushReadingPosition() {
  clearTimeout(scrollTimer)
  scrollPercent.value = currentScrollPct()
  store.syncCurrentBookProgress(scrollPercent.value)
}

async function restoreScrollPosition(scrollPct) {
  if (!bodyRef.value || !scrollPct || store.settings.readingMode !== 'scroll') return
  await nextTick()
  await nextTick()
  let maxScroll = bodyRef.value.scrollHeight - bodyRef.value.clientHeight
  if (maxScroll <= 0) {
    await new Promise(resolve => setTimeout(resolve, 50))
    maxScroll = bodyRef.value.scrollHeight - bodyRef.value.clientHeight
  }
  if (maxScroll <= 0) return
  bodyRef.value.scrollTop = (scrollPct / 100) * maxScroll
  scrollPercent.value = scrollPct
}

function backToLibrary() {
  flushReadingPosition()
  router.push('/')
}
</script>

<style scoped>
.reader {
  height: 100vh;
  display: flex;
  flex-direction: column;
  user-select: none;
  background: var(--surface-page);
  color: var(--text-primary);
  transition: background 0.4s, color 0.4s;
  overflow: hidden;
}

/* ── Header ── */
.r-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  -webkit-app-region: drag;
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 4px;
  background: var(--surface-page);
  border-bottom: 1px solid var(--border-light);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: 20;
}
.r-header.visible { opacity: 1; pointer-events: auto; }
.r-hdr-btn {
  width: 36px; height: 36px; border-radius: 8px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: inherit; opacity: 0.55;
  transition: opacity 0.15s, background 0.15s;
  -webkit-app-region: no-drag; flex-shrink: 0;
}
.r-hdr-btn:hover { opacity: 1; background: rgba(128,128,128,0.08); }
.r-hdr-btn.active {
  opacity: 1;
  color: var(--color-primary);
  background: rgba(201,107,44,0.1);
}
.chapter-label {
  font-size: 13px; opacity: 0.6;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1; text-align: center; -webkit-app-region: drag;
}

/* ── Body ── */
.r-body {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding-top: 56px;
  padding-bottom: 32px;
}
.r-body.paged { overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 0; }
.r-body.slide { overflow: hidden; position: relative; padding: 0; }

.r-loading-wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
.r-loading { display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.4; font-size: 14px; }

/* ── Scroll content ── */
.r-content {
  margin: 0 auto;
  animation: chapterIn 0.3s ease-out;
}
@keyframes chapterIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.chapter-heading {
  font-size: 1.3em; font-weight: 700; text-align: center;
  margin-bottom: 36px; opacity: 0.7; letter-spacing: 0.05em;
}
.chapter-text { text-align: justify; }
.chapter-text :deep(p) {
  text-indent: 2em; margin-bottom: 0.6em; line-height: inherit;
}

/* ── Slide mode ── */
.r-slide-container {
  width: 100%; height: 100%;
  overflow: hidden; position: relative;
}
.r-slide-wrapper {
  width: 100%; height: 100%;
  will-change: transform;
}
.r-slide-page {
  width: 100%; min-height: 100%;
  margin: 0 auto;
}
.slide-page-indicator {
  position: fixed; bottom: 48px; left: 50%; transform: translateX(-50%);
  font-size: 12px; color: var(--text-secondary); opacity: 0.5;
  background: var(--surface-glass); padding: 2px 12px; border-radius: 10px;
}

/* ── Paged content ── */
.r-paged-wrap {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.r-paged-page {
  margin: 0 auto; overflow-y: auto;
  max-height: calc(100vh - 80px); scroll-behavior: smooth;
}

/* ── Footer ── */
.r-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; align-items: center;
  padding: 8px 16px; gap: 10px; font-size: 12px;
  z-index: 20;
  background: var(--surface-page);
  border-top: 1px solid var(--border-light);
  -webkit-app-region: no-drag;
  opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.r-footer.visible { opacity: 1; pointer-events: auto; }
.chap-indicator { opacity: 0.45; white-space: nowrap; min-width: 40px; }
.progress-pct { opacity: 0.4; min-width: 30px; text-align: right; font-variant-numeric: tabular-nums; }
.time-est { opacity: 0.35; font-size: 11px; white-space: nowrap; }
.cache-state {
  min-width: 52px;
  text-align: center;
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
}
.cache-state.cached { color: #2ea043; }
.cache-state.network { color: var(--color-primary); }
.cache-state.loading { opacity: 0.5; }
.progress-track {
  flex: 1; height: 3px;
  background: rgba(128,128,128,0.15); border-radius: 2px;
  cursor: pointer; overflow: hidden;
}
.progress-track:hover { height: 6px; }
.progress-fill {
  height: 100%; background: #c96b2c; border-radius: 2px;
  transition: width 0.15s linear;
}
</style>
