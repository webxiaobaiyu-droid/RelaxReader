---
name: ui-design
description: Use when designing or implementing UI/UX for desktop applications, especially reading/book applications. Covers color schemes (light/dark/sepia themes), typography for long-form reading, responsive layouts, transition animations, component design patterns, glassmorphism/neumorphism styles, and CSS preprocessor conventions (SCSS/Less).
---

# UI Design Skill for Desktop Reader Apps

## 翻页动画实现

### CSS 3D 仿真翻页（不依赖库）
```css
/* 翻页容器 */
.flip-container {
  perspective: 1500px;
  position: relative;
  width: 100%;
  height: 100%;
}

/* 页面基础 */
.flip-page {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  transition: transform 0.6s cubic-bezier(0.645, 0.045, 0.355, 1);
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

/* 翻页中 - 纸张弯曲效果 */
.flip-page.flipping {
  transform: rotateY(-180deg);
  box-shadow: 
    -10px 0 30px rgba(0,0,0,0.2),
    inset -5px 0 10px rgba(0,0,0,0.1);
}

/* 纸张背面 */
.flip-page .back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  background: var(--surface-page);
}

/* 翻页阴影 - 模拟纸张厚度 */
.flip-page::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 30px;
  height: 100%;
  background: linear-gradient(
    to right,
    transparent,
    rgba(0,0,0,0.1) 50%,
    rgba(0,0,0,0.2)
  );
  opacity: 0;
  transition: opacity 0.3s;
}

.flip-page.flipping::after {
  opacity: 1;
}
```

### 翻页 JS 控制
```js
class FlipAnimation {
  constructor(container) {
    this.container = container
    this.isFlipping = false
    this.currentAngle = 0
  }

  // 跟随鼠标翻页（半翻状态）
  followMouse(x) {
    if (this.isFlipping) return
    const rect = this.container.getBoundingClientRect()
    const progress = x / rect.width
    this.currentAngle = progress * -180
    this.page.style.transform = `rotateY(${this.currentAngle}deg)`
    
    // 动态阴影
    const shadow = Math.abs(progress) * 0.3
    this.page.style.boxShadow = 
      `${-10 * progress}px 0 ${30 * shadow}px rgba(0,0,0,${shadow})`
  }

  // 完成翻页
  async flip(direction = 'next') {
    if (this.isFlipping) return
    this.isFlipping = true
    
    const target = direction === 'next' ? -180 : 0
    this.page.style.transition = 'transform 0.5s cubic-bezier(0.645, 0.045, 0.355, 1)'
    this.page.style.transform = `rotateY(${target}deg)`
    
    await new Promise(r => setTimeout(r, 500))
    this.page.style.transition = ''
    this.isFlipping = false
  }
}
```

### 左右滑动翻页（起点读书风格）
```css
.slide-container {
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
}

.slide-wrapper {
  display: flex;
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  will-change: transform;
}

.slide-page {
  min-width: 100%;
  flex-shrink: 0;
}

/* 拖拽时禁用过渡 */
.slide-wrapper.dragging {
  transition: none;
}
```

```js
// 触摸/鼠标滑动翻页
class SlideAnimation {
  constructor(container) {
    this.startX = 0
    this.currentX = 0
    this.isDragging = false
    
    container.addEventListener('mousedown', this.onStart.bind(this))
    container.addEventListener('mousemove', this.onMove.bind(this))
    container.addEventListener('mouseup', this.onEnd.bind(this))
  }

  onMove(e) {
    if (!this.isDragging) return
    const diff = e.clientX - this.startX
    this.wrapper.style.transform = 
      `translateX(${-this.currentIndex * 100 + (diff / this.width * 100)}%)`
  }

  onEnd(e) {
    const diff = e.clientX - this.startX
    const threshold = this.width * 0.2
    
    if (Math.abs(diff) > threshold) {
      this.currentIndex += diff > 0 ? -1 : 1
    }
    this.goToPage(this.currentIndex)
    this.isDragging = false
  }
}
```

---

## 毛玻璃效果（Glassmorphism）

### 用于菜单、侧边栏
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* 深色主题 */
[data-theme="dark"] .glass-panel {
  background: rgba(30, 30, 30, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

---

## 骨架屏（加载状态）

```vue
<template>
  <div class="skeleton">
    <div class="skeleton-title" />
    <div class="skeleton-line" v-for="i in lines" :key="i"
      :style="{ width: widths[i % widths.length] }" />
  </div>
</template>

<style scoped>
.skeleton-line {
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(
    90deg, 
    var(--border-light) 25%, 
    var(--surface-overlay) 50%, 
    var(--border-light) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
```

---

## 微交互设计

### 按钮悬停效果
```css
.btn-primary {
  transition: 
    transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.15s ease;
}

.btn-primary:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 16px rgba(201, 107, 44, 0.4);
}

.btn-primary:active {
  transform: scale(0.97);
}
```

### 卡片悬浮效果
```css
.book-card {
  transition: 
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.book-card:hover {
  transform: translateY(-6px);
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.14),
    0 2px 6px rgba(0, 0, 0, 0.08);
}

.book-card:active {
  transform: translateY(0) scale(0.98);
}
```

### 页面切换动画
```css
/* 滑入滑出 */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: 
    opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
```

---

## 阅读器特定 UI

### 进度条（精确到段落）
```css
.progress-bar {
  height: 3px;
  background: rgba(128, 128, 128, 0.15);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.progress-bar:hover {
  height: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.15s linear;
}

/* 章节标记点 */
.progress-bar .chapter-marks {
  position: absolute;
  top: 0;
  width: 100%;
  height: 100%;
}

.progress-bar .mark {
  position: absolute;
  width: 2px;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
}
```

### 底部工具栏
```css
.reader-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 12px;
  background: linear-gradient(to top, var(--surface-page), transparent);
  font-size: 12px;
  z-index: 20;
}

.chapter-indicator {
  opacity: 0.5;
  white-space: nowrap;
}

.progress-pct {
  opacity: 0.4;
  font-variant-numeric: tabular-nums;
}
```

### 自动隐藏的头部
```css
.reader-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  background: linear-gradient(to bottom, var(--surface-page), transparent);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  z-index: 20;
}

.reader-header.visible {
  opacity: 1;
  pointer-events: auto;
}
```

---

## 设计令牌系统

```css
:root {
  /* 颜色 */
  --color-primary: #c96b2c;
  --color-primary-light: #e8925e;
  --color-primary-dark: #a0522d;
  --color-success: #2e7d32;
  --color-error: #c62828;
  
  /* 表面 */
  --surface-page: #f5f0e8;
  --surface-card: #ffffff;
  --surface-overlay: rgba(0, 0, 0, 0.04);
  --surface-glass: rgba(255, 255, 255, 0.72);
  
  /* 文本 */
  --text-primary: #2c2416;
  --text-secondary: #8c7a6b;
  --text-tertiary: #b8a99a;
  
  /* 边框 */
  --border-light: #e8e0d5;
  
  /* 阴影 */
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.10);
  
  /* 圆角 */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  
  /* 缓动 */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  /* 时长 */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  
  /* 安全区域 */
  --titlebar-h: 0px;
  --safe-area-top: env(safe-area-inset-top, 0px);
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}

/* macOS */
html[data-platform="darwin"] {
  --titlebar-h: 38px;
}
```
