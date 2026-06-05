# 项目约定 (Project Conventions)

## 技术栈
- **框架**: Electron + Vue3 (Composition API + `<script setup>`)
- **语言**: JavaScript (非 TypeScript)
- **构建**: electron-vite
- **状态管理**: Pinia
- **路由**: Vue Router (hash mode)
- **样式**: CSS custom properties + Scoped styles
- **打包**: electron-builder

## 代码风格
- 使用 ES Module (`import`/`export`)
- 组件文件使用 PascalCase: `ReaderView.vue`
- Composables 使用 camelCase: `useBookLoader.js`
- Store 使用 camelCase: `reader.js`
- 常量使用 UPPER_SNAKE_CASE
- CSS 类名使用 kebab-case + BEM: `.book-card__title--featured`

## 文件结构
```
src/
├── main/          # Electron 主进程
│   ├── index.js   # 入口，窗口创建
│   ├── ipc/       # IPC 处理器
│   └── store/     # 主进程数据存储
├── preload/       # 预加载脚本
│   └── index.js   # contextBridge 暴露 API
└── renderer/      # Vue3 渲染进程
    ├── App.vue
    ├── main.js
    ├── router/
    ├── store/
    ├── composables/
    ├── components/
    ├── views/
    └── assets/
```

## IPC 通信约定
- 命名格式: `domain:action` (如 `fs:readFile`, `dialog:openFile`)
- 请求-响应: `ipcMain.handle` + `ipcRenderer.invoke`
- 事件推送: `ipcMain.send` + `ipcRenderer.on`
- 所有 IPC handler 需 try-catch 并返回 `{ success, data, error }` 格式
