---
name: electron-vue3-dev
description: Electron + Vue3 + JavaScript + Node desktop app development — main/preload/renderer architecture, IPC patterns, contextBridge security, Pinia stores, Vue Router hash mode, composables, electron-store persistence, electron-vite build, electron-builder packaging
---
# Electron + Vue3 + JS Desktop App Development

You build cross-platform Electron desktop apps with Vue3 (Composition API, `<script setup>`), plain JavaScript, Pinia, Vue Router, and electron-vite. Follow these patterns.

## Project Architecture

```
src/
├── main/           # Electron main process (Node.js)
│   ├── index.js    # BrowserWindow, app lifecycle
│   └── ipc/        # IPC handlers organized by feature
├── preload/        # contextBridge — the ONLY bridge to renderer
│   └── index.js
└── renderer/       # Vue3 SPA
    ├── App.vue
    ├── main.js
    ├── router/
    ├── store/      # Pinia stores
    ├── composables/# reusable Composition API hooks
    ├── components/ # shared components
    └── views/      # route-level views
```

## Main Process (`src/main/index.js`)

```js
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    minWidth: 800, minHeight: 600,
    titleBarStyle: 'hiddenInset',   // macOS native feel
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,       // MUST be true
      nodeIntegration: false,       // MUST be false
      sandbox: false
    }
  })

  // Load dev server in dev, built HTML in production
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

## Preload — The Security Boundary

Only expose what the renderer genuinely needs. Use `contextBridge.exposeInMainWorld`:

```js
// src/preload/index.js
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openFileDialog: (opts) => ipcRenderer.invoke('dialog:openFile', opts),

  // File I/O
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, data) => ipcRenderer.invoke('fs:writeFile', path, data),

  // App info
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Event subscriptions (whitelist channels)
  on: (channel, cb) => {
    const allowed = ['menu:action', 'update:available']
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, ...a) => cb(...a))
  }
})
```

## IPC Patterns

### Request-Response: `ipcMain.handle` + `ipcRenderer.invoke`
```js
// src/main/ipc/dialog.js
import { ipcMain, dialog } from 'electron'

ipcMain.handle('dialog:openFile', async (_, opts) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: opts?.filters ?? []
  })
  return canceled ? null : filePaths[0]
})
```

### Fire-and-Forget: `ipcMain.on` + `ipcRenderer.send`
```js
ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})
```

### Always return structured results:
```js
// Good:
return { success: true, data: content }
return { success: false, error: 'File not found' }

// Bad: throw (won't serialize over IPC well)
```

## Vue3 Patterns (all in `<script setup>`)

### Props, Emits, Reactive State
```vue
<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'

const props = defineProps({
  bookId: { type: String, required: true }
})
const emit = defineEmits(['progress'])

const content = ref('')
const settings = reactive({
  fontSize: 18,
  lineHeight: 1.8,
  theme: 'light'
})

const containerStyle = computed(() => ({
  fontSize: `${settings.fontSize}px`,
  lineHeight: settings.lineHeight,
  backgroundColor: settings.theme === 'dark' ? '#1a1a1a' : '#f5f0e8'
}))

watch(() => settings.fontSize, (v) => {
  localStorage.setItem('reader-fontSize', v)
})

onMounted(() => {
  settings.fontSize = Number(localStorage.getItem('reader-fontSize') || 18)
})
</script>
```

### Composables (`src/renderer/composables/`)
Extract reusable logic:
```js
// useBookLoader.js
import { ref, readonly } from 'vue'

export function useBookLoader() {
  const book = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function load(path) {
    loading.value = true
    try {
      const data = await window.electronAPI.readFile(path)
      book.value = parseBook(data)  // your parser
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { book: readonly(book), loading, error, load }
}
```

### Pinia Store
```js
// src/renderer/store/reader.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useReaderStore = defineStore('reader', () => {
  const books = ref([])
  const currentBook = ref(null)
  const settings = ref({ theme: 'light', fontSize: 18, lineHeight: 1.8 })

  const bookCount = computed(() => books.value.length)
  const currentTitle = computed(() => currentBook.value?.title ?? '')

  function addBook(book) {
    books.value.push({ ...book, id: crypto.randomUUID(), addedAt: Date.now() })
  }
  function removeBook(id) {
    books.value = books.value.filter(b => b.id !== id)
  }

  return { books, currentBook, settings, bookCount, currentTitle, addBook, removeBook }
})
```

### Vue Router (hash mode for Electron)
```js
// src/renderer/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'library', component: () => import('../views/LibraryView.vue') },
  { path: '/reader/:bookId', name: 'reader', component: () => import('../views/ReaderView.vue'), props: true },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
]

export default createRouter({ history: createWebHashHistory(), routes })
```

## Data Persistence

Use `electron-store` in the main process for persistent data:
```js
// src/main/store.js
import Store from 'electron-store'

export const libStore = new Store({
  name: 'library',
  defaults: { books: [], settings: { theme: 'light', fontSize: 18 } }
})

// Expose via IPC:
ipcMain.handle('store:get', (_, key) => libStore.get(key))
ipcMain.handle('store:set', (_, key, val) => { libStore.set(key, val); return true })
```

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Vue components | PascalCase | `ReaderView.vue`, `BookCard.vue` |
| Composables | camelCase, `use` prefix | `useBookLoader.js` |
| Pinia stores | camelCase | `reader.js`, `library.js` |
| IPC channels | `domain:action` | `fs:readFile`, `dialog:openFile` |
| CSS classes | kebab-case + BEM | `.book-card__title--featured` |
| Constants | UPPER_SNAKE_CASE | `MAX_RECENT_BOOKS` |

## Key Rules

1. **contextIsolation: true ALWAYS** — never enable nodeIntegration in renderer
2. **IPC is the only bridge** — renderer never imports Node modules directly
3. **Hash history** for Vue Router — `createWebHashHistory()` avoids Electron file:// issues
4. **`<style scoped>`** on every component to prevent style leaks
5. **`readonly()`** exports from composables to prevent accidental mutation
6. **Try-catch all IPC handlers** — unhandled rejections crash the main process
7. **`electron-store` for app data, `localStorage` for transient UI state** (font size, scroll position)
8. **Debounce progress saves** — don't write to disk on every scroll event (300ms debounce)
9. **Check `process.platform`** for platform-specific behavior (tray, window controls, shortcuts)
10. **electron-vite** handles HMR in dev and optimized builds — don't fight its config
