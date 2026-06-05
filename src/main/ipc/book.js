import { ipcMain } from 'electron'
import { parseTxt } from '../parser/txt.js'
import { createHash } from 'crypto'
import fs from 'fs'

export function registerBookHandlers() {
  ipcMain.handle('book:parse', async (_, filePath) => {
    try {
      const ext = filePath.toLowerCase().match(/\.[^.]+$/)?.[0]

      if (ext === '.txt') {
        const result = parseTxt(filePath)

        // Generate stable ID from file path
        const id = createHash('md5').update(filePath).digest('hex').slice(0, 12)
        const stat = fs.statSync(filePath)

        return {
          success: true,
          data: {
            id,
            title: result.title,
            author: result.author,
            filePath,
            format: 'txt',
            totalChapters: result.chapters.length,
            chapters: result.chapters,
            addedAt: Date.now(),
            lastReadAt: null,
            progress: 0,
            cover: null,
            fileSize: stat.size
          }
        }
      }

      return { success: false, error: `暂不支持 ${ext} 格式` }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
