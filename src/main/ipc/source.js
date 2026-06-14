import { ipcMain } from 'electron'
import { searchBooks, fetchBook, fetchChapter, testSource } from '../engine/searcher.js'
import { parseBookPage, fetchChapterContent } from '../engine/universal.js'
import libStore from '../store.js'
import {
  listSources, upsertSource, removeSource,
  replaceSources, resetHealth, resetToBuiltins
} from '../sources/registry.js'

export function registerSourceHandlers() {
  // ── Source management ──
  ipcMain.handle('source:list', () => {
    try { return { success: true, data: listSources() } }
    catch (err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('source:save', (_, source) => {
    try {
      if (!source?.name || !source?.baseUrl) {
        return { success: false, error: '请填写名称和站点地址' }
      }
      // Only persist the fields we want to save — don't let syncBuiltins overwrite
      const saved = upsertSource(source)
      return { success: true, data: saved }
    } catch (err) { return { success: false, error: err.message } }
  })

  // Toggle enable/disable — writes directly, bypassing sync concerns
  ipcMain.handle('source:toggle', (_, id, enabled) => {
    try {
      const all = listSources()
      const idx = all.findIndex(s => s.id === id)
      if (idx < 0) return { success: false, error: '书源不存在' }
      all[idx] = { ...all[idx], enabled: !!enabled }
      libStore.set('sources', all)
      return { success: true }
    } catch (err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('source:delete', (_, id) => {
    try { return removeSource(id) }
    catch (err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('source:reset', (_, id) => {
    try { resetHealth(id); return { success: true } }
    catch (err) { return { success: false, error: err.message } }
  })

  // Wipe all custom sources, keep only builtins with latest config
  ipcMain.handle('source:resetAll', () => {
    try { resetToBuiltins(); return { success: true } }
    catch (err) { return { success: false, error: err.message } }
  })

  // Probe a source with a known keyword and record health
  ipcMain.handle('source:test', async (_, id, keyword) => {
    try { return await testSource(id, keyword || '剑') }
    catch (err) { return { success: false, error: err.message } }
  })

  // Bulk import/export — used by source-sharing
  ipcMain.handle('source:export', () => {
    try {
      // Strip health when exporting — it's a local concern
      const data = listSources().map(({ health, builtin, ...rest }) => rest)
      return { success: true, data }
    } catch (err) { return { success: false, error: err.message } }
  })

  ipcMain.handle('source:import', (_, sources) => {
    try { return replaceSources(sources) }
    catch (err) { return { success: false, error: err.message } }
  })

  // Legacy scraper search (keeps working if source sites are reachable)
  ipcMain.handle('source:search', async (_, keyword, sourceId) => {
    if (!keyword || keyword.trim().length < 1) {
      return { success: false, error: '请输入搜索关键词' }
    }
    return searchBooks(keyword.trim(), sourceId || null)
  })

  // Universal URL import — works with any novel site
  ipcMain.handle('source:parseUrl', async (_, url) => {
    if (!url) return { success: false, error: '请输入网址' }
    return parseBookPage(url)
  })

  // Universal chapter fetch — works with any chapter page
  ipcMain.handle('source:fetchContent', async (_, chapterUrl) => {
    if (!chapterUrl) return { success: false, error: '缺少章节地址' }
    return fetchChapterContent(chapterUrl)
  })

  // Legacy
  ipcMain.handle('source:fetchBook', async (_, sourceId, bookUrl) => {
    if (!sourceId || !bookUrl) return { success: false, error: '缺少必要参数' }
    return fetchBook(sourceId, bookUrl)
  })

  ipcMain.handle('source:fetchChapter', async (_, sourceId, chapterUrl) => {
    if (!sourceId || !chapterUrl) return { success: false, error: '缺少必要参数' }
    return fetchChapter(sourceId, chapterUrl)
  })
}
