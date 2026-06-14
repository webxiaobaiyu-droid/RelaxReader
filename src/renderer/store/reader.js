import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'

export const useReaderStore = defineStore('reader', () => {
  // ── Library ──
  const books = ref([])
  const loaded = ref(false)
  const cacheStats = ref({ chapters: 0, size: 0, byBook: {} })

  // ── Current reading ──
  const currentBook = ref(null)
  const currentChapterIndex = ref(0)
  const scrollPosition = ref(0)        // 0–100 percentage within chapter

  // ── Settings (reactive for direct property mutation reactivity) ──
  const settings = reactive({
    theme: 'light',         // 'light' | 'dark' | 'sepia'
    fontSize: 18,           // 12–32
    lineHeight: 1.8,        // 1.2–2.8
    readingMode: 'scroll',  // 'scroll' | 'paged'
    fontFamily: 'default',  // 'default' | 'serif' | 'sans'
    pageWidth: 720,         // 480–960 (content max-width in px)
    marginH: 24             // 16–64 (horizontal padding in px)
  })

  // ── Getters ──
  const totalChapters = computed(() => currentBook.value?.chapters?.length ?? 0)
  const currentChapter = computed(() =>
    currentBook.value?.chapters?.[currentChapterIndex.value] ?? null
  )
  const progressPercent = computed(() => {
    if (!totalChapters.value) return 0
    const chapterProgress = currentChapterIndex.value / totalChapters.value
    const intraProgress = (scrollPosition.value / 100) / totalChapters.value
    return Math.round((chapterProgress + intraProgress) * 100)
  })

  // ── Persistence ──

  /** Load books from electron-store on app start */
  async function loadBooks() {
    if (loaded.value) return
    try {
      const result = await window.electronAPI?.getBooks()
      if (result?.success && Array.isArray(result.data)) {
        books.value = result.data
      }
    } catch (e) {
      console.error('Failed to load books:', e)
    } finally {
      loaded.value = true
    }
  }

  /** Persist books metadata (without chapter content) to electron-store */
  async function persistBooks() {
    if (!loaded.value) return
    try {
      const meta = books.value.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        filePath: b.filePath,
        format: b.format,
        cover: b.cover,
        totalChapters: b.totalChapters,
        addedAt: b.addedAt,
        lastReadAt: b.lastReadAt,
        lastChapter: b.lastChapter ?? 0,
        progress: b.progress ?? 0,
        lastScrollPos: b.lastScrollPos ?? 0,
        bookmarks: Array.isArray(b.bookmarks) ? b.bookmarks : [],
        cachedChapters: b.cachedChapters ?? 0,
        cacheSize: b.cacheSize ?? 0,
        fileSize: b.fileSize,
        // Online book fields — needed to re-fetch chapters
        sourceId: b.sourceId ?? null,
        bookUrl: b.bookUrl ?? null
      }))
      await window.electronAPI?.saveBooks(meta)
    } catch (e) {
      console.error('Failed to save books:', e)
    }
  }

  /** Load settings from electron-store */
  async function loadSettings() {
    try {
      const result = await window.electronAPI?.getSettings()
      if (result?.success && result.data) {
        Object.assign(settings, result.data)
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  /** Load chapter cache stats for library badges and settings surfaces */
  async function loadCacheStats() {
    try {
      const result = await window.electronAPI?.getChapterCacheStats()
      if (result?.success && result.data) {
        cacheStats.value = result.data
        for (const book of books.value) {
          const stats = result.data.byBook?.[book.id]
          book.cachedChapters = stats?.chapters ?? 0
          book.cacheSize = stats?.size ?? 0
        }
      }
    } catch (e) {
      console.error('Failed to load cache stats:', e)
    }
  }

  async function clearBookCache(bookId) {
    try {
      const result = await window.electronAPI?.clearChapterCache(bookId)
      if (result?.success) {
        await loadCacheStats()
        const book = books.value.find(b => b.id === bookId)
        if (book) {
          book.cachedChapters = 0
          book.cacheSize = 0
        }
      }
      return result
    } catch (e) {
      console.error('Failed to clear cache:', e)
      return { success: false, error: e.message }
    }
  }

  /** Persist settings */
  async function persistSettings() {
    try {
      await window.electronAPI?.saveSettings({ ...settings })
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  // Auto-persist on changes
  watch(books, persistBooks, { deep: true })
  watch(() => ({ ...settings }), persistSettings, { deep: true })

  // ── Actions ──

  /** Add a book to the library (with full chapter data). Deduplicates by id. */
  function addBook(book) {
    const exists = books.value.find(b => b.id === book.id)
    if (exists) {
      // Update metadata (preserve chapters if already loaded)
      Object.assign(exists, {
        title: book.title,
        author: book.author,
        totalChapters: book.totalChapters,
        fileSize: book.fileSize,
        lastReadAt: book.lastReadAt,
        lastChapter: book.lastChapter ?? exists.lastChapter ?? 0,
        progress: book.progress ?? exists.progress ?? 0
      })
      exists.bookmarks = Array.isArray(book.bookmarks) ? book.bookmarks : (exists.bookmarks ?? [])
      exists.lastScrollPos = book.lastScrollPos ?? exists.lastScrollPos ?? 0
      if (book.chapters && !exists.chapters) {
        exists.chapters = book.chapters
      }
    } else {
      books.value.unshift(book)
    }
  }

  /** Remove a book from the library */
  function removeBook(id) {
    books.value = books.value.filter(b => b.id !== id)
    if (currentBook.value?.id === id) {
      currentBook.value = null
      currentChapterIndex.value = 0
      scrollPosition.value = 0
    }
  }

  /** Open a book for reading. Loads full data if needed, restores last position. */
  async function openBook(bookMeta) {
    const existing = books.value.find(b => b.id === bookMeta.id)
    if (existing?.chapters?.length) {
      // Already have chapters loaded
      currentBook.value = existing
    } else if (existing?.sourceId === 'universal' && existing?.bookUrl) {
      // Universal URL book — re-parse the page (must come BEFORE the generic
      // 'online' branch since universal books also have format='online')
      try {
        const res = await window.electronAPI?.parseUrl(existing.bookUrl)
        if (res?.success && res.data?.chapters?.length) {
          existing.chapters = res.data.chapters.map((ch, i) => ({
            index: i, title: ch.title, url: ch.url, content: ''
          }))
          existing.totalChapters = existing.chapters.length
        }
      } catch (e) {
        console.error('Failed to re-parse book page:', e)
      }
      currentBook.value = existing
    } else if (existing?.format === 'online' && existing?.bookUrl) {
      // Online book without chapters — re-fetch from registered source
      try {
        const res = await window.electronAPI?.fetchSourceBook(existing.sourceId, existing.bookUrl)
        if (res?.success && res.data?.chapters?.length) {
          existing.chapters = res.data.chapters.map((ch, i) => ({
            index: i, title: ch.title, url: ch.url, content: ''
          }))
          existing.totalChapters = existing.chapters.length
          if (res.data.title) existing.title = res.data.title
          if (res.data.author) existing.author = res.data.author
          if (res.data.cover) existing.cover = res.data.cover
        }
      } catch (e) {
        console.error('Failed to re-fetch chapters:', e)
      }
      currentBook.value = existing
    } else if (existing?.filePath) {
      // Local file — re-parse
      const result = await window.electronAPI?.parseBook(existing.filePath)
      if (result?.success && result.data) {
        const parsed = {
          ...result.data,
          lastReadAt: existing.lastReadAt,
          lastChapter: existing.lastChapter ?? 0,
          lastScrollPos: existing.lastScrollPos ?? 0,
          progress: existing.progress ?? 0,
          bookmarks: existing.bookmarks ?? [],
          cachedChapters: existing.cachedChapters ?? 0,
          cacheSize: existing.cacheSize ?? 0
        }
        addBook(parsed)
        currentBook.value = books.value.find(b => b.id === parsed.id) ?? parsed
      }
    } else {
      currentBook.value = existing ?? null
    }
    if (currentBook.value) {
      currentBook.value.lastReadAt = Date.now()
      currentChapterIndex.value = currentBook.value.lastChapter ?? 0
      scrollPosition.value = currentBook.value.lastScrollPos ?? 0
    }
  }

  /** Navigate to a specific chapter */
  function goToChapter(index) {
    if (index >= 0 && index < totalChapters.value) {
      currentChapterIndex.value = index
      scrollPosition.value = 0
      if (currentBook.value) {
        currentBook.value.lastChapter = index
        currentBook.value.progress = totalChapters.value > 0
          ? Math.round(((index + 1) / totalChapters.value) * 100)
          : 0
      }
    }
  }

  /** Update reading progress — called from ReaderView on scroll. */
  function updateProgress(scrollPct) {
    scrollPosition.value = scrollPct
    if (currentBook.value) {
      currentBook.value.lastScrollPos = scrollPct
      currentBook.value.lastChapter = currentChapterIndex.value
      // Overall progress: chapter-level + intra-chapter contribution
      const chapterProgress = totalChapters.value > 0
        ? currentChapterIndex.value / totalChapters.value
        : 0
      const intraProgress = totalChapters.value > 0
        ? (scrollPct / 100) / totalChapters.value
        : 0
      currentBook.value.progress = Math.round((chapterProgress + intraProgress) * 100)
    }
  }

  function syncCurrentBookProgress(scrollPct = scrollPosition.value) {
    if (!currentBook.value) return
    updateProgress(scrollPct)
    currentBook.value.lastReadAt = Date.now()

    const libraryBook = books.value.find(b => b.id === currentBook.value.id)
    if (libraryBook && libraryBook !== currentBook.value) {
      libraryBook.lastReadAt = currentBook.value.lastReadAt
      libraryBook.lastChapter = currentBook.value.lastChapter ?? currentChapterIndex.value
      libraryBook.lastScrollPos = currentBook.value.lastScrollPos ?? scrollPct
      libraryBook.progress = currentBook.value.progress ?? 0
      libraryBook.bookmarks = currentBook.value.bookmarks ?? libraryBook.bookmarks ?? []
    }
  }

  function bookmarkKey(bookId, chapterIndex, scrollPct) {
    return `${bookId}-${chapterIndex}-${Math.round(scrollPct)}`
  }

  function isCurrentBookmarked() {
    if (!currentBook.value) return false
    const pct = Math.round(scrollPosition.value)
    return (currentBook.value.bookmarks ?? []).some(b =>
      b.chapterIndex === currentChapterIndex.value && Math.abs((b.scrollPct ?? 0) - pct) <= 2
    )
  }

  function toggleBookmark(note = '') {
    if (!currentBook.value || !currentChapter.value) return false
    const pct = Math.round(scrollPosition.value)
    const bookmarks = currentBook.value.bookmarks ?? []
    const existingIndex = bookmarks.findIndex(b =>
      b.chapterIndex === currentChapterIndex.value && Math.abs((b.scrollPct ?? 0) - pct) <= 2
    )

    if (existingIndex >= 0) {
      bookmarks.splice(existingIndex, 1)
      currentBook.value.bookmarks = bookmarks
      return false
    }

    bookmarks.push({
      id: bookmarkKey(currentBook.value.id, currentChapterIndex.value, pct),
      chapterIndex: currentChapterIndex.value,
      chapterTitle: currentChapter.value.title,
      scrollPct: pct,
      note,
      createdAt: Date.now()
    })
    bookmarks.sort((a, b) => a.chapterIndex - b.chapterIndex || a.scrollPct - b.scrollPct)
    currentBook.value.bookmarks = bookmarks
    return true
  }

  return {
    books, loaded, cacheStats, currentBook, currentChapterIndex, currentChapter,
    scrollPosition, settings, totalChapters, progressPercent,
    loadBooks, loadSettings, loadCacheStats, clearBookCache,
    addBook, removeBook, openBook, goToChapter, updateProgress,
    syncCurrentBookProgress, isCurrentBookmarked, toggleBookmark
  }
})
