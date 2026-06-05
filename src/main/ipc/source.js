import { ipcMain } from 'electron'
import { searchBooks, fetchBook, fetchChapter } from '../engine/searcher.js'
import { parseBookPage, fetchChapterContent } from '../engine/universal.js'

export function registerSourceHandlers() {
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
