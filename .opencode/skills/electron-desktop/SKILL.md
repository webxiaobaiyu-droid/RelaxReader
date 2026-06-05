---
name: electron-desktop
description: Use when building Electron desktop applications with main/renderer process patterns, IPC communication, window management, native menus, tray, file dialogs, system integration, preload scripts, contextBridge, process isolation, electron-builder packaging, or auto-updater workflows. Also use for electron-vite project structure.
---

# Electron Desktop Development Skill

## 项目结构（electron-vite）

```
relaxReader/
├── electron.vite.config.js
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── index.js          # 主进程入口
│   │   ├── ipc/              # IPC 处理器
│   │   │   ├── index.js      # 注册所有 handler
│   │   │   ├── book.js       # 书籍解析
│   │   │   ├── dialog.js     # 文件对话框
│   │   │   ├── fs.js         # 文件操作
│   │   │   ├── store.js      # 持久化存储
│   │   │   ├── source.js     # 在线书源
│   │   │   └── window.js     # 窗口控制
│   │   ├── engine/           # 爬虫引擎
│   │   │   ├── parser.js     # HTML 解析器
│   │   │   ├── searcher.js   # 搜索器
│   │   │   └── universal.js  # 通用解析
│   │   ├── sources/          # 书源配置
│   │   │   └── builtin.js
│   │   ├── parser/           # 本地文件解析
│   │   │   └── txt.js
│   │   └── store.js          # electron-store
│   ├── preload/
│   │   └── index.js          # contextBridge
│   └── renderer/
│       ├── App.vue
│       ├── main.js
│       ├── router/
│       ├── store/
│       ├── composables/
│       ├── components/
│       ├── views/
│       └── assets/
├── build/                    # 应用图标
└── package.json
```

## IPC 通信模式

### 请求-响应（推荐）
```js
// renderer → main → renderer
const result = await window.electronAPI.invoke('channel', ...args)
```

### 单向通知
```js
// renderer → main（不关心结果）
window.electronAPI.send('window:minimize')

// main → renderer（推送事件）
mainWindow.webContents.send('app:before-quit')
```

### 安全的 Preload
```js
// src/preload/index.js
import { contextBridge, ipcRenderer } from 'electron'

const VALID_CHANNELS = [
  'dialog:openFile', 'fs:readFile', 'fs:saveFile',
  'book:parse', 'source:search', 'source:fetchBook',
  'source:fetchChapter', 'source:parseUrl', 'source:fetchContent',
  'store:getBooks', 'store:saveBooks', 'store:getSettings', 'store:saveSettings',
  'app:version', 'app:platform'
]

const VALID_SEND_CHANNELS = ['window:minimize', 'window:maximize', 'window:close']
const VALID_RECEIVE_CHANNELS = ['app:before-quit', 'app:menu-action']

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (VALID_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`))
  },
  send: (channel, ...args) => {
    if (VALID_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  on: (channel, callback) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args))
    }
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})
```

## 窗口管理

### 主窗口配置
```js
// src/main/index.js
import { app, BrowserWindow, shell, Menu } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Relax Reader',
    titleBarStyle: 'hiddenInset',  // macOS 原生标题栏
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 外部链接用浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 开发/生产环境加载
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:before-quit')
  }
})
```

## IPC Handler 模式

### 标准 handler（带错误处理）
```js
// src/main/ipc/store.js
import { ipcMain, app } from 'electron'
import store from '../store.js'

export function registerStoreHandlers() {
  ipcMain.handle('store:getBooks', () => {
    try {
      return { success: true, data: store.get('books', []) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('store:saveBooks', (_, books) => {
    try {
      store.set('books', books)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
```

## electron-builder 配置

```yaml
# electron-builder.yml
appId: com.relaxreader.app
productName: RelaxReader
directories:
  buildResources: build
  output: dist
files:
  - out/**/*
  - '!node_modules'
mac:
  category: public.app-category.books
  target: [dmg, zip]
  artifactName: ${name}-${version}-mac.${ext}
win:
  target: [nsis]
  artifactName: ${name}-${version}-win.${ext}
linux:
  target: [AppImage, deb]
  category: Utility
  artifactName: ${name}-${version}-linux.${ext}
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  deleteAppDataOnUninstall: true
```

## 性能优化

### 懒加载 IPC handler
```js
// 只在需要时注册 handler
ipcMain.handle('heavy:task', async () => {
  const { heavyFunction } = await import('./heavy-module.js')
  return heavyFunction()
})
```

### 窗口预热
```js
// 在 app.ready 之前创建窗口但不显示
function createWindow() {
  mainWindow = new BrowserWindow({ show: false })
  // ... 配置
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}
```
