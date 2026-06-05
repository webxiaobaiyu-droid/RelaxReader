# Relax Reader

一款简洁优雅的跨平台桌面小说阅读器，基于 Electron + Vue3 构建。

## 功能特性

### 书籍管理
- **本地导入**：支持 TXT 文件（自动编码检测：UTF-8/GBK/UTF-16）
- **智能章节识别**：自动识别「第X章」等常见章节格式
- **在线书源**：内置笔趣阁书源，支持搜索、添加在线小说
- **书架管理**：右键菜单删除书籍，阅读进度自动保存

### 阅读体验
- **三种翻页模式**：滚动 / 滑动 / 翻页
- **标准点击区域**：左30%上一页、右30%下一页、中间40%菜单
- **阅读设置**：主题（浅色/深色/护眼）、字体、字号、行高、内容宽度、页边距
- **目录侧边栏**：快速跳转章节，当前章节高亮
- **进度追踪**：精确进度百分比、预计阅读时间
- **自动滚动**：一键自动滚动阅读
- **快捷键**：T目录、S设置、PageUp/Down切章、Esc返回

### 在线功能
- **笔趣阁搜索**：输入书名搜索在线小说
- **章节缓存**：自动预加载下一章
- **多书源支持**：可扩展的书源配置

## 技术栈

- **框架**：Electron + Vue3 (Composition API)
- **构建**：electron-vite
- **状态管理**：Pinia
- **路由**：Vue Router (Hash 模式)
- **样式**：CSS Custom Properties + Scoped Styles
- **打包**：electron-builder

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.js             # 窗口创建、菜单、应用生命周期
│   ├── ipc/                 # IPC 处理器
│   │   ├── book.js          # 书籍解析
│   │   ├── source.js        # 在线书源
│   │   ├── store.js         # 持久化存储
│   │   └── ...
│   ├── engine/              # 爬虫引擎
│   │   ├── parser.js        # HTML 解析（支持 gzip）
│   │   ├── searcher.js      # 搜索/书籍/章节获取
│   │   └── universal.js     # 通用页面解析
│   ├── sources/             # 书源配置
│   └── parser/              # 本地文件解析
├── preload/                 # 安全桥接层
│   └── index.js             # contextBridge API
└── renderer/                # Vue3 渲染进程
    ├── App.vue              # 根组件、主题变量
    ├── views/
    │   ├── LibraryView.vue  # 书架页
    │   ├── ReaderView.vue   # 阅读器页
    │   └── SettingsView.vue # 设置页
    ├── components/          # 通用组件
    ├── store/               # Pinia 状态管理
    └── router/              # 路由配置
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 打包应用
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| T | 打开/关闭目录 |
| S | 打开/关闭设置 |
| ← / ↑ | 上一页（滑动/翻页模式） |
| → / ↓ / 空格 | 下一页（滑动/翻页模式） |
| PageUp | 上一章 |
| PageDown | 下一章 |
| Esc | 返回书架 |

## 许可证

MIT License
