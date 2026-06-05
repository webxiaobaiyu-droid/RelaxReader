import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  getVersions: () => ipcRenderer.invoke('app:versions'),

  // File operations
  openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),

  // Book parsing (main process)
  parseBook: (filePath) => ipcRenderer.invoke('book:parse', filePath),

  // Book source — universal URL import
  parseUrl: (url) => ipcRenderer.invoke('source:parseUrl', url),
  fetchContent: (chapterUrl) => ipcRenderer.invoke('source:fetchContent', chapterUrl),

  // Book source — legacy scraper
  searchSource: (keyword, sourceId) => ipcRenderer.invoke('source:search', keyword, sourceId),
  fetchSourceBook: (sourceId, bookUrl) => ipcRenderer.invoke('source:fetchBook', sourceId, bookUrl),
  fetchSourceChapter: (sourceId, chapterUrl) => ipcRenderer.invoke('source:fetchChapter', sourceId, chapterUrl),

  // Persistent store
  getBooks: () => ipcRenderer.invoke('store:getBooks'),
  saveBooks: (books) => ipcRenderer.invoke('store:saveBooks', books),
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('store:saveSettings', settings),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Events
  on: (channel, callback) => {
    const validChannels = ['app:menu-action', 'app:before-quit']
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    }
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})
