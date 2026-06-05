---
name: novel-reader
description: Use when building a desktop novel/ebook reader application. Covers EPUB/TXT parsing, chapters/catalog management, reading progress tracking, bookmarks, themes (light/dark/sepia), font/typography settings, text layout (pagination, scroll modes), reading statistics, library/bookshelf management, cover extraction, and reading experience optimizations.
---

# Desktop Novel Reader Skill

## 产品设计原则（To C 思维）

### 核心体验指标
- **打开即读**：从启动到开始阅读 < 2秒
- **零打扰**：阅读时无任何系统弹窗/通知
- **容错性**：误操作可撤销（删书、误翻页）
- **一致性**：所有交互遵循相同的心智模型

### 竞品参考
| 产品 | 值得借鉴 |
|------|---------|
| 微信读书 | 翻页动画、笔记高亮、社交分享 |
| Kindle | 字体排版、进度预测、X-Ray |
| 起点读书 | 目录缓存、夜间模式、自动翻页 |
| QQ阅读 | 翻页模式切换、护眼模式 |
| Apple Books | 纸质翻页效果、3D Touch 预览 |

---

## 翻页模式（核心功能）

### 1. 滚动模式（Scroll）
```css
/* 连续滚动，适合长文 */
.reader-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}
```

### 2. 左右滑动（Slide）
```css
/* 横向翻页，类似起点读书 */
.reader-slide {
  display: flex;
  overflow-x: snap;
  scroll-snap-type: x mandatory;
}
.reader-slide .page {
  scroll-snap-align: start;
  min-width: 100vw;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

### 3. 仿真翻页（Flip）— 使用 StPageFlip
```js
// npm install page-flip
import { PageFlip } from 'page-flip'

const flip = new PageFlip('#reader', {
  width: 600,
  height: 800,
  size: 'fixed',
  maxShadowOpacity: 0.5,
  showCover: true,
  mobileScrollSupport: false,
  flippingTime: 800,
  drawShadow: true,
  autoSize: true,
  clickEventForward: true,
  useMouseEvents: true,
  swipeDistance: 30,
  flippingTime: 500
})

flip.loadFromHTML('.page')
flip.on('flip', (e) => {
  console.log('Current page:', e.data)
})
```

### 4. 覆盖模式（Cover）
```css
/* 上一页从上方滑出，下一页覆盖当前页 */
.page-cover-enter { transform: translateY(-100%); }
.page-cover-leave { transform: translateY(100%); }
```

### 5. 淡入淡出（Fade）
```css
.reader-fade .page {
  transition: opacity 0.4s ease;
}
.reader-fade .page.active { opacity: 1; }
.reader-fade .page.inactive { opacity: 0; }
```

---

## 点击区域设计（主流标准）

```
┌─────────────────────────────────┐
│         菜单区域 (点击唤出)        │
├────────┬──────────┬─────────────┤
│  上一页  │   菜单   │    下一页    │
│ (30%)  │  (40%)   │   (30%)     │
├────────┴──────────┴─────────────┤
│         进度条（可拖动）           │
└─────────────────────────────────┘
```

```js
function handlePageClick(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  // 上方 15% = 菜单
  if (y < 0.15) { toggleMenu(); return }

  // 左侧 30% = 上一页
  if (x < 0.3) { prevPage(); return }

  // 右侧 30% = 下一页
  if (x > 0.7) { nextPage(); return }

  // 中间 40% = 菜单
  toggleMenu()
}
```

---

## 字体与排版（阅读体验核心）

### 推荐字体栈
```css
:root {
  /* 中文优先字体 */
  --font-default: -apple-system, BlinkMacSystemFont, "PingFang SC", 
                  "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-serif: "Noto Serif SC", "Source Han Serif SC", 
                "Songti SC", Georgia, serif;
  --font-kai: "STKaiti", "KaiTi", "楷体", serif;
  --font-song: "SimSun", "宋体", serif;
  
  /* 阅读最佳参数 */
  --reading-font-size: 18px;      /* 16-24px 范围 */
  --reading-line-height: 1.8;     /* 1.6-2.2 范围 */
  --reading-letter-spacing: 0.5px;
  --reading-paragraph-spacing: 1em;
  --reading-max-width: 720px;     /* 每行最佳字数 35-45 */
  --reading-padding: 48px 32px;
}
```

### 首行缩进（中文小说标准）
```css
.chapter-text p {
  text-indent: 2em;
  margin-bottom: var(--reading-paragraph-spacing);
}
```

### 段落间距控制
```js
const TYPOGRAPHY_PRESETS = {
  compact:  { fontSize: 16, lineHeight: 1.6, paragraphSpacing: 0.5 },
  normal:   { fontSize: 18, lineHeight: 1.8, paragraphSpacing: 1.0 },
  relaxed:  { fontSize: 20, lineHeight: 2.0, paragraphSpacing: 1.5 },
  large:    { fontSize: 24, lineHeight: 2.2, paragraphSpacing: 2.0 }
}
```

---

## 主题系统

### 四种标准主题
```js
const THEMES = {
  light: {
    name: '日间',
    bg: '#ffffff',
    text: '#333333',
    secondary: '#666666',
    border: '#e8e8e8',
    card: '#ffffff'
  },
  dark: {
    name: '夜间',
    bg: '#1a1a1a',
    text: '#cccccc',
    secondary: '#888888',
    border: '#333333',
    card: '#222222'
  },
  sepia: {
    name: '护眼',
    bg: '#f5f0e8',
    text: '#5b4636',
    secondary: '#8b7355',
    border: '#e0d5c0',
    card: '#faf5e8'
  },
  green: {
    name: '绿底',
    bg: '#e8f5e9',
    text: '#2e7d32',
    secondary: '#4caf50',
    border: '#c8e6c9',
    card: '#f1f8e9'
  }
}
```

### 亮度调节（独立于系统）
```js
function setBrightness(level) {
  // level: 0.3 - 1.0
  document.documentElement.style.filter = `brightness(${level})`
  localStorage.setItem('brightness', level)
}
```

---

## 阅读进度与统计

### 进度计算（精确到段落）
```js
function calculateProgress(scrollTop, scrollHeight, clientHeight) {
  return Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
}
```

### 阅读速度估算
```js
function estimateReadingTime(charCount) {
  const CHARS_PER_MINUTE = 400  // 中文平均阅读速度
  const minutes = Math.ceil(charCount / CHARS_PER_MINUTE)
  if (minutes < 1) return '不到1分钟'
  if (minutes < 60) return `${minutes}分钟`
  return `${Math.floor(minutes/60)}小时${minutes%60}分钟`
}
```

### 阅读统计
```js
const readingStats = {
  todayMinutes: 0,
  totalMinutes: 0,
  booksFinished: 0,
  chaptersRead: 0,
  lastReadTime: null,
  streak: 0  // 连续阅读天数
}
```

---

## 书签与笔记

### 书签数据结构
```js
const bookmark = {
  id: 'uuid',
  bookId: 'book-uuid',
  chapterIndex: 5,
  paragraphIndex: 12,  // 段落索引（比滚动百分比更稳定）
  selectedText: '被选中的文字...',
  note: '用户笔记',
  createdAt: Date.now(),
  color: '#ffeb3b'  // 高亮颜色
}
```

### 高亮实现
```css
.highlight-yellow { background: rgba(255, 235, 59, 0.4); }
.highlight-green { background: rgba(76, 175, 80, 0.3); }
.highlight-blue { background: rgba(33, 150, 243, 0.3); }
.highlight-pink { background: rgba(233, 30, 99, 0.2); }
```

---

## 快捷键设计

| 功能 | 快捷键 | 备选 |
|------|--------|------|
| 上一页 | ← / ↑ / PageUp | 鼠标滚轮上 |
| 下一页 | → / ↓ / PageDown / Space | 鼠标滚轮下 |
| 上一章 | Ctrl + ← | 双指左滑 |
| 下一章 | Ctrl + → | 双指右滑 |
| 目录 | T / Ctrl + T | 侧边栏 |
| 书签 | B / Ctrl + D | 顶栏按钮 |
| 全屏 | F11 | 顶栏按钮 |
| 设置 | S | 顶栏按钮 |
| 退出阅读 | Esc | 返回按钮 |
| 搜索 | Ctrl + F | 顶栏按钮 |

---

## 性能优化

### 虚拟滚动（超长章节）
```js
// 只渲染可视区域的段落
function renderVisibleParagraphs(paragraphs, scrollTop, clientHeight) {
  const BUFFER = 5  // 上下各缓冲5段
  const start = Math.max(0, findIndex(scrollTop) - BUFFER)
  const end = Math.min(paragraphs.length, findIndex(scrollTop + clientHeight) + BUFFER)
  return paragraphs.slice(start, end)
}
```

### 章节预加载
```js
async function preloadChapters(currentIndex, chapters) {
  const PRELOAD_COUNT = 2
  for (let i = 1; i <= PRELOAD_COUNT; i++) {
    const next = chapters[currentIndex + i]
    if (next && !next.content) {
      fetchChapterContent(next.url).then(content => {
        next.content = content
      })
    }
  }
}
```

---

## 目录侧边栏

### 设计要点
1. 固定宽度 280px，从左侧滑入
2. 当前章节高亮 + 自动滚动到可视区域
3. 显示章节数量和已读标记
4. 支持搜索章节标题

```vue
<template>
  <aside class="toc-sidebar" :class="{ open: visible }">
    <div class="toc-header">
      <h3>目录</h3>
      <span class="toc-count">{{ chapters.length }}章</span>
    </div>
    <div class="toc-search">
      <input v-model="filter" placeholder="搜索章节..." />
    </div>
    <div class="toc-list">
      <button
        v-for="(ch, i) in filteredChapters"
        :key="i"
        :class="{ current: i === currentIndex, read: i < currentIndex }"
        @click="$emit('jump', i)"
      >
        <span class="ch-num">{{ i + 1 }}</span>
        <span class="ch-title">{{ ch.title }}</span>
        <span class="ch-read" v-if="i < currentIndex">✓</span>
      </button>
    </div>
  </aside>
</template>
```

---

## 数据持久化

### 存储分层
```
electron-store (JSON)
├── books[]          # 书籍元数据（不含章节内容）
├── settings         # 用户设置
├── bookmarks[]      # 书签
└── stats            # 阅读统计

文件系统
└── cache/
    └── {bookId}/
        ├── meta.json    # 书籍详情
        └── chapters/    # 章节缓存
            ├── 0.txt
            ├── 1.txt
            └── ...
```

### 章节缓存策略
```js
async function getChapterContent(bookId, chapterIndex, url) {
  const cachePath = `cache/${bookId}/chapters/${chapterIndex}.txt`
  
  // 1. 先查缓存
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath, 'utf-8')
  }
  
  // 2. 再查内存
  const chapter = currentBook.chapters[chapterIndex]
  if (chapter?.content) return chapter.content
  
  // 3. 最后网络请求
  const content = await fetchChapterContent(url)
  fs.writeFileSync(cachePath, content)
  return content
}
```

---

## 易用性改进清单

### 必须有（P0）
- [x] 翻页动画（至少支持滚动和左右滑动）
- [x] 点击区域标准化（左30/中40/右30）
- [x] 进度条可点击跳转
- [x] 章节预加载
- [x] 阅读进度持久化
- [x] 快捷键支持

### 应该有（P1）
- [ ] 仿真翻页效果（StPageFlip）
- [ ] 亮度调节
- [ ] 自动翻页
- [ ] 阅读统计
- [ ] 书签高亮
- [ ] 目录搜索

### 可以有（P2）
- [ ] 听书（TTS）
- [ ] 翻译集成
- [ ] 笔记导出
- [ ] 阅读打卡
- [ ] 书籍推荐
