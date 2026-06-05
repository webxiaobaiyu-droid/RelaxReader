import { defineStore } from 'pinia'
import { ref, reactive, computed, watch } from 'vue'

export const useReaderStore = defineStore('reader', () => {
  // ── Library ──
  const books = ref([])
  const loaded = ref(false)

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
    } else if (existing?.format === 'online' && existing?.bookUrl) {
      // Online book without chapters — re-fetch from source
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
    } else if (existing?.sourceId === 'universal' && existing?.bookUrl) {
      // Universal URL book — re-parse the page
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
    } else if (existing?.filePath) {
      // Local file — re-parse
      const result = await window.electronAPI?.parseBook(existing.filePath)
      if (result?.success && result.data) {
        currentBook.value = result.data
        addBook(result.data)
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

  return {
    books, loaded, currentBook, currentChapterIndex, currentChapter,
    scrollPosition, settings, totalChapters, progressPercent,
    loadBooks, loadSettings,
    addBook, removeBook, openBook, goToChapter, updateProgress
  }
})
