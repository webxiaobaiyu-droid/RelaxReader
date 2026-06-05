import { app, BrowserWindow, shell, Menu, dialog } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { registerIpcHandlers } from './ipc/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const APP_VERSION = '1.0.0'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin'

  const template = [
    // macOS: 第一个菜单是应用名
    ...(isMac ? [{
      label: 'Relax Reader',
      submenu: [
        { label: '关于 Relax Reader', click: showAbout },
        { type: 'separator' },
        { label: '偏好设置...', accelerator: 'Cmd+,', click: () => mainWindow?.webContents.send('app:menu-action', 'settings') },
        { type: 'separator' },
        { label: '服务', role: 'services' },
        { type: 'separator' },
        { label: '隐藏 Relax Reader', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出 Relax Reader', role: 'quit' }
      ]
    }] : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        { label: '打开书籍...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('app:menu-action', 'open') },
        { type: 'separator' },
        isMac ? { label: '关闭窗口', role: 'close' } : { label: '退出', role: 'quit' }
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    },
    // 阅读菜单
    {
      label: '阅读',
      submenu: [
        { label: '目录', accelerator: 'T', click: () => mainWindow?.webContents.send('app:menu-action', 'toc') },
        { label: '书签', accelerator: 'B', click: () => mainWindow?.webContents.send('app:menu-action', 'bookmark') },
        { type: 'separator' },
        { label: '上一章', accelerator: 'PageUp', click: () => mainWindow?.webContents.send('app:menu-action', 'prev-chapter') },
        { label: '下一章', accelerator: 'PageDown', click: () => mainWindow?.webContents.send('app:menu-action', 'next-chapter') },
        { type: 'separator' },
        { label: '阅读设置', accelerator: 'S', click: () => mainWindow?.webContents.send('app:menu-action', 'settings') },
        { label: '自动滚动', click: () => mainWindow?.webContents.send('app:menu-action', 'auto-scroll') }
      ]
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        { label: '全屏', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
        { type: 'separator' },
        { label: '开发者工具', role: 'toggleDevTools' }
      ]
    },
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        { label: '关于 Relax Reader', click: showAbout },
        { type: 'separator' },
        { label: '检查更新...', click: checkForUpdates },
        { type: 'separator' },
        { label: '反馈问题...', click: () => shell.openExternal('https://github.com/relaxreader/relax-reader/issues') },
        { label: '项目主页', click: () => shell.openExternal('https://github.com/relaxreader/relax-reader') }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于 Relax Reader',
    message: 'Relax Reader',
    detail: `版本：v${APP_VERSION}\n框架：Electron + Vue3\n平台：${process.platform} ${process.arch}\nNode：${process.versions.node}\nElectron：${process.versions.electron}\n\n一款简洁优雅的跨平台小说阅读器\n支持本地 TXT/EPUB 和在线书源`,
    buttons: ['确定'],
    defaultId: 0,
    noLink: true
  })
}

function checkForUpdates() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '检查更新',
    message: '当前已是最新版本',
    detail: `Relax Reader v${APP_VERSION}`,
    buttons: ['确定']
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  buildMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:before-quit')
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
