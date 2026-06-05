import { ipcMain } from 'electron'
import fs from 'fs'

export function registerFsHandlers() {
  ipcMain.handle('fs:readFile', async (_, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data: content }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:readFileBuffer', async (_, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }
      const buffer = fs.readFileSync(filePath)
      return { success: true, data: buffer.toString('base64') }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('fs:stat', async (_, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' }
      }
      const stat = fs.statSync(filePath)
      return {
        success: true,
        data: {
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          birthtime: stat.birthtime.toISOString()
        }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
