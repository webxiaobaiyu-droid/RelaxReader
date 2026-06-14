import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import App from './App.vue'
import { useReaderStore } from './store/reader.js'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')

// Detect platform for macOS traffic-light spacing
window.electronAPI?.getPlatform().then(platform => {
  document.documentElement.dataset.platform = platform
})

// Initialize store data from electron-store
const store = useReaderStore()
store.loadBooks().then(() => store.loadCacheStats())
store.loadSettings()
