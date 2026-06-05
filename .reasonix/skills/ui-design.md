---
name: ui-design
description: Beautiful UI/UX design for desktop reader apps — glassmorphism, warm color palettes, bookshelf layouts, reading themes (light/dark/sepia), smooth transitions, typography, CSS custom properties design system
---
# UI Design Skill — Desktop Reader Apps

You are a UI/UX designer specializing in beautiful, clean desktop reader applications. Every component you design should feel calm, warm, and inviting.

## Design System (CSS Custom Properties)

Always start by defining design tokens. Here's the base system for Relax Reader:

```css
:root {
  /* ── Warm Primary ── */
  --color-primary: #c96b2c;
  --color-primary-light: #e8925e;
  --color-primary-dark: #a0522d;
  --color-primary-bg: rgba(201, 107, 44, 0.08);

  /* ── Surfaces ── */
  --surface-page: #f5f0e8;          /* warm paper-like background */
  --surface-card: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.72);
  --surface-overlay: rgba(0, 0, 0, 0.04);

  /* ── Text ── */
  --text-primary: #2c2416;
  --text-secondary: #8c7a6b;
  --text-tertiary: #b8a99a;

  /* ── Borders & Shadows ── */
  --border-light: #e8e0d5;
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.10);
  --shadow-float: 0 20px 48px rgba(0, 0, 0, 0.12);

  /* ── Spacing (4px base) ── */
  --space-xs: 4px;  --space-sm: 8px;  --space-md: 16px;
  --space-lg: 24px; --space-xl: 32px; --space-2xl: 48px;

  /* ── Typography ── */
  --text-xs: 12px;  --text-sm: 14px;  --text-base: 16px;
  --text-lg: 18px;  --text-xl: 24px;  --text-2xl: 32px;

  /* ── Radius ── */
  --radius-sm: 6px;  --radius-md: 10px;
  --radius-lg: 16px; --radius-full: 9999px;

  /* ── Motion ── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
}

/* Dark theme */
[data-theme="dark"] {
  --surface-page: #1a1814;
  --surface-card: #252320;
  --surface-glass: rgba(37, 35, 32, 0.85);
  --text-primary: #e8dcc8;
  --text-secondary: #9c9080;
  --text-tertiary: #6c6258;
  --border-light: #363330;
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-elevated: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* Sepia reading theme */
[data-theme="sepia"] {
  --surface-page: #f4ecd8;
  --surface-card: #faf5e8;
  --text-primary: #5b4636;
  --text-secondary: #8b7355;
}
```

## Bookshelf (Library View) — The Hero Page

This is the home screen. Make it beautiful.

### Layout: masonry grid with variable-sized cards
```css
.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-lg);
  padding: var(--space-lg);
}
```

### Book card with glassmorphism + hover lift
```vue
<template>
  <div class="book-card" @click="openBook">
    <div class="book-cover-wrap">
      <img :src="book.cover" class="book-cover" />
      <div class="book-progress-badge" v-if="book.progress">
        {{ book.progress }}%
      </div>
    </div>
    <div class="book-meta">
      <h3 class="book-title">{{ book.title }}</h3>
      <p class="book-author">{{ book.author }}</p>
    </div>
  </div>
</template>
```

Key visual details:
- Cover images have `aspect-ratio: 3/4`, `object-fit: cover`, subtle inner shadow
- On hover: `transform: translateY(-4px)` + elevated shadow + slight scale on cover
- Progress badge: small pill at bottom-right of cover, semi-transparent glass
- Empty state: centered illustration-style placeholder with "拖拽或点击导入" text

### Import button: floating action style
```css
.btn-import {
  position: fixed;
  bottom: 32px;
  right: 32px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  border: none;
  box-shadow: var(--shadow-elevated);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--duration-fast) var(--ease-spring),
              box-shadow var(--duration-fast);
}
.btn-import:hover {
  transform: scale(1.08);
  box-shadow: var(--shadow-float);
}
```

## Reading View — Distraction-Free

### Auto-hiding header (show on mouse near top)
```css
.reader-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-lg);
  background: linear-gradient(to bottom, var(--surface-page), transparent);
  opacity: 0;
  transition: opacity var(--duration-normal);
  z-index: 10;
}
.reader-header.visible { opacity: 1; }
```

### Centered reading column
```css
.reader-content {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-2xl) var(--space-xl);
  font-size: var(--reader-font-size, 18px);
  line-height: var(--reader-line-height, 1.8);
  text-align: justify;
  overflow-y: auto;
  height: 100vh;
  scroll-behavior: smooth;
}
```

### Page turn animation (for paged mode)
```css
.page-enter-active { animation: slideIn 0.4s var(--ease-out); }
.page-leave-active { animation: slideOut 0.4s var(--ease-out); }
@keyframes slideIn {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes slideOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-40px); }
}
```

## Context Menu (Right-Click)

Glass-morphism floating menu with keyboard shortcut hints:
```css
.context-menu {
  position: fixed;
  background: var(--surface-glass);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--space-xs);
  min-width: 200px;
  box-shadow: var(--shadow-elevated);
  z-index: 9999;
}
.context-item {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  cursor: pointer;
}
.context-item:hover { background: var(--surface-overlay); }
.context-item kbd {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
```

## Animation Principles

1. **Stagger children**: grid items appear with 50ms delay each on page enter
2. **Hover = subtle lift**: cards lift 4px with shadow increase, no scale above 1.02
3. **Page transitions**: slide-fade, 300ms, ease-out curve
4. **Button press**: 2px scale down on :active
5. **Loading**: skeleton screens matching card shape, shimmer animation

## Color & Mood

- The app is called "Relax Reader" — everything should feel **calm, warm, unhurried**
- Use warm earth tones: terracotta primary, cream backgrounds, brown text
- Never use pure black (#000) or pure white (#fff) — always tinted
- Dark theme should feel like reading by candlelight, not a code editor
- Sepia should feel like an aged paperback

## When implementing UI:

1. Always define CSS custom properties first
2. Use `<style scoped>` in Vue components
3. Prefer CSS Grid for layouts, Flexbox for alignment
4. Use `backdrop-filter` for glass effects (with fallback solid color)
5. Test hover states — every interactive element needs one
6. Keep the reading view as minimal as possible — the content IS the UI
