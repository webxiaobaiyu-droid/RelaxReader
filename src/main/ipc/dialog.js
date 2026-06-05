import { ipcMain, dialog } from 'electron'

export function registerDialogHandlers() {
  ipcMain.handle('dialog:openFile', async (_, options) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: options?.filters ?? [
          { name: '文本文件', extensions: ['txt', 'epub', 'md'] }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    } catch (err) {
      console.error('dialog:openFile error:', err)
      return null
    }
  })
}
