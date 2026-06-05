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
