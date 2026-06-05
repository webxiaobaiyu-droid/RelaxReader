---
name: vue3-frontend
description: Use when building Vue3 + JavaScript frontend applications. Covers Composition API, reactive state (ref/reactive), computed, watch, Pinia store, Vue Router, component patterns (props/emits/slots), composables, provide/inject, template directives (v-if/v-for/v-model), lifecycle hooks, teleport, transition animations, and Vite build tooling.
---

# Vue3 + JavaScript Frontend Skill

## 核心模式

### Composition API（`<script setup>`）
```vue
<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'

// Props / Emits
const props = defineProps({ bookId: { type: String, required: true } })
const emit = defineEmits(['close', 'jump'])

// 状态
const loading = ref(false)
const settings = reactive({ fontSize: 18, theme: 'light' })

// 计算属性
const style = computed(() => ({
  fontSize: settings.fontSize + 'px',
  background: settings.theme === 'dark' ? '#1a1a1a' : '#fff'
}))

// 监听
watch(() => settings.fontSize, (val) => {
  localStorage.setItem('fontSize', val)
})

// 生命周期
onMounted(async () => {
  const saved = localStorage.getItem('fontSize')
  if (saved) settings.fontSize = Number(saved)
})
</script>
```

### Composables（可复用逻辑）
```js
// src/composables/useLocalStorage.js
import { ref, watch } from 'vue'

export function useLocalStorage(key, defaultValue) {
  const stored = localStorage.getItem(key)
  const data = ref(stored ? JSON.parse(stored) : defaultValue)
  
  watch(data, (val) => {
    localStorage.setItem(key, JSON.stringify(val))
  }, { deep: true })
  
  return data
}
```

### Pinia Store
```js
// src/store/reader.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useReaderStore = defineStore('reader', () => {
  // State
  const books = ref([])
  const currentBook = ref(null)
  const currentChapterIndex = ref(0)

  // Getters
  const totalChapters = computed(() => currentBook.value?.chapters?.length ?? 0)
  const currentChapter = computed(() =>
    currentBook.value?.chapters?.[currentChapterIndex.value] ?? null
  )

  // Actions
  function addBook(book) {
    const exists = books.value.find(b => b.id === book.id)
    if (!exists) books.value.unshift(book)
  }

  function goToChapter(index) {
    if (index >= 0 && index < totalChapters.value) {
      currentChapterIndex.value = index
    }
  }

  return { books, currentBook, currentChapterIndex, 
           totalChapters, currentChapter,
           addBook, goToChapter }
})
```

### Vue Router（Hash 模式）
```js
// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'library', component: () => import('../views/LibraryView.vue') },
  { path: '/reader/:bookId', name: 'reader', component: () => import('../views/ReaderView.vue'), props: true },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
```

### Provide/Inject（跨组件通信）
```vue
<!-- App.vue -->
<script setup>
import { provide } from 'vue'
import { ref } from 'vue'

const toastRef = ref(null)
provide('toast', {
  success: (msg) => toastRef.value?.show(msg, 'success'),
  error: (msg) => toastRef.value?.show(msg, 'error')
})
</script>

<!-- 任意子组件 -->
<script setup>
import { inject } from 'vue'
const toast = inject('toast')
toast.success('操作成功')
</script>
```

### Transition 动画
```vue
<template>
  <router-view v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.page-enter-from { opacity: 0; transform: translateY(12px); }
.page-leave-to { opacity: 0; transform: translateY(-12px); }
</style>
```

### Teleport（模态框/菜单）
```vue
<template>
  <teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content">
        <slot />
      </div>
    </div>
  </teleport>
</template>
```

## 关键原则

1. 用 `<script setup>` 简洁语法
2. 基本类型用 `ref`，对象用 `reactive`
3. Composable 用 `readonly` 暴露状态
4. Electron 中用 `createWebHashHistory`
5. `defineProps` / `defineEmits` 无需导入
6. 深层组件通信用 `provide` / `inject`
7. 大数据用 `shallowRef` 优化
8. 样式用 `<style scoped>` 隔离
9. 用 `Transition` / `TransitionGroup` 做动画
10. 模板中用 PascalCase 组件名
