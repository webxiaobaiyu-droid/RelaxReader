import { ipcMain, app } from 'electron'
import libStore from '../store.js'

export function registerStoreHandlers() {
  // Library data
  ipcMain.handle('store:getBooks', () => {
    try {
      return { success: true, data: libStore.get('books', []) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('store:saveBooks', (_, books) => {
    try {
      libStore.set('books', books)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Settings
  ipcMain.handle('store:getSettings', () => {
    try {
      return { success: true, data: libStore.get('settings') }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('store:saveSettings', (_, settings) => {
    try {
      libStore.set('settings', settings)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Chapter cache
  ipcMain.handle('store:getChapterCache', (_, bookId, chapterIndex) => {
    try {
      const cache = libStore.get('chapterCache', {})
      const key = chapterCacheKey(bookId, chapterIndex)
      return { success: true, data: cache[key] ?? null }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('store:saveChapterCache', (_, payload) => {
    try {
      if (!payload?.bookId || payload.chapterIndex == null) {
        return { success: false, error: '缺少章节缓存参数' }
      }
      const cache = libStore.get('chapterCache', {})
      const key = chapterCacheKey(payload.bookId, payload.chapterIndex)
      cache[key] = {
        bookId: payload.bookId,
        chapterIndex: payload.chapterIndex,
        chapterTitle: payload.chapterTitle || '',
        content: payload.content || '',
        sourceId: payload.sourceId || null,
        chapterUrl: payload.chapterUrl || null,
        fetchedAt: Date.now(),
        size: Buffer.byteLength(payload.content || '', 'utf8')
      }
      libStore.set('chapterCache', cache)
      return { success: true, data: cache[key] }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('store:getChapterCacheStats', () => {
    try {
      return { success: true, data: getChapterCacheStats() }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('store:clearChapterCache', (_, bookId = null) => {
    try {
      if (!bookId) {
        libStore.set('chapterCache', {})
      } else {
        const cache = libStore.get('chapterCache', {})
        for (const key of Object.keys(cache)) {
          if (cache[key]?.bookId === bookId) delete cache[key]
        }
        libStore.set('chapterCache', cache)
      }
      return { success: true, data: getChapterCacheStats() }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // App info
  ipcMain.handle('app:version', () => '1.0.0')
  ipcMain.handle('app:platform', () => process.platform)
  ipcMain.handle('app:versions', () => ({
    app: '1.0.0',
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch
  }))
}

function chapterCacheKey(bookId, chapterIndex) {
  return `${bookId}::${Number(chapterIndex)}`
}

function getChapterCacheStats() {
  const cache = libStore.get('chapterCache', {})
  const entries = Object.values(cache)
  const byBook = {}
  let totalSize = 0

  for (const entry of entries) {
    const size = entry.size ?? Buffer.byteLength(entry.content || '', 'utf8')
    totalSize += size
    if (!byBook[entry.bookId]) byBook[entry.bookId] = { chapters: 0, size: 0, latestFetchedAt: null }
    byBook[entry.bookId].chapters += 1
    byBook[entry.bookId].size += size
    byBook[entry.bookId].latestFetchedAt = Math.max(byBook[entry.bookId].latestFetchedAt || 0, entry.fetchedAt || 0)
  }

  return {
    chapters: entries.length,
    size: totalSize,
    byBook
  }
}
