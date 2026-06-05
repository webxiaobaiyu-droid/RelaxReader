<template>
  <div class="settings">
    <!-- Header -->
    <header class="s-header">
      <button class="btn-icon" @click="$router.go(-1)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h2 class="s-title">阅读设置</h2>
      <div class="header-spacer" />
    </header>

    <!-- Body -->
    <main class="s-body">
      <!-- ═══ Live Preview ═══ -->
      <section class="preview-card" :style="previewStyle">
        <p class="preview-label">预览效果</p>
        <p class="preview-text">
          这是一段预览文字，用于展示当前设置下的阅读效果。字里行间的距离、文字的大小与字体，都在此实时呈现。你可以调整下方的各项参数来找到最舒适的阅读体验。
        </p>
      </section>

      <!-- ═══ Theme ═══ -->
      <section class="setting-block">
        <h3 class="block-title">阅读主题</h3>
        <div class="theme-cards">
          <button
            v-for="t in themes"
            :key="t.key"
            class="theme-card"
            :class="{ active: store.settings.theme === t.key }"
            :style="{ background: t.bg, color: t.fg }"
            @click="store.settings.theme = t.key"
          >
            <span class="tc-text">{{ t.preview }}</span>
            <span class="tc-label">{{ t.label }}</span>
            <svg v-if="store.settings.theme === t.key" class="tc-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
      </section>

      <!-- ═══ Font Family ═══ -->
      <section class="setting-block">
        <h3 class="block-title">字体</h3>
        <div class="font-options">
          <button
            v-for="f in fontFamilies"
            :key="f.key"
            class="font-btn"
            :class="{ active: store.settings.fontFamily === f.key }"
            @click="store.settings.fontFamily = f.key"
          >{{ f.label }}</button>
        </div>
      </section>

      <!-- ═══ Font Size ═══ -->
      <section class="setting-block">
        <h3 class="block-title">字号</h3>
        <div class="slider-row">
          <span class="slider-icon slider-icon--small">A</span>
          <input
            type="range"
            class="styled-slider"
            min="12" max="32" step="1"
            :value="store.settings.fontSize"
            @input="store.settings.fontSize = +$event.target.value"
          />
          <span class="slider-icon slider-icon--large">A</span>
        </div>
      </section>

      <!-- ═══ Line Height ═══ -->
      <section class="setting-block">
        <h3 class="block-title">
          行间距
          <span class="block-value">{{ store.settings.lineHeight.toFixed(1) }}</span>
        </h3>
        <div class="lh-visual" :style="{ '--lh': store.settings.lineHeight }">
          <span class="lh-line" v-for="i in 4" :key="i" />
        </div>
        <input
          type="range"
          class="styled-slider"
          min="1.4" max="2.8" step="0.1"
          :value="store.settings.lineHeight"
          @input="store.settings.lineHeight = +$event.target.value"
        />
      </section>

      <!-- ═══ Page Width ═══ -->
      <section class="setting-block">
        <h3 class="block-title">
          内容宽度
          <span class="block-value">{{ store.settings.pageWidth }}px</span>
        </h3>
        <input
          type="range"
          class="styled-slider"
          min="480" max="960" step="20"
          :value="store.settings.pageWidth"
          @input="store.settings.pageWidth = +$event.target.value"
        />
      </section>

      <!-- ═══ Margin ═══ -->
      <section class="setting-block">
        <h3 class="block-title">
          页边距
          <span class="block-value">{{ store.settings.marginH }}px</span>
        </h3>
        <input
          type="range"
          class="styled-slider"
          min="16" max="64" step="4"
          :value="store.settings.marginH"
          @input="store.settings.marginH = +$event.target.value"
        />
      </section>

      <!-- ═══ About ═══ -->
      <section class="about-card">
        <div class="about-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#c96b2c"/>
            <path d="M14 12h20v2H14zM14 18h16v2H14zM14 24h20v2H14zM14 30h14v2H14zM14 36h18v2H14z" fill="rgba(255,255,255,0.9)"/>
            <path d="M30 28c0-6.627-4.477-12-10-12S10 21.373 10 28" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none"/>
          </svg>
          <div class="about-name">
            <h3>Relax Reader</h3>
            <span class="about-version">v{{ versions.app }}</span>
          </div>
        </div>
        <p class="about-desc">一款简洁优雅的跨平台小说阅读器</p>
        <div class="about-info">
          <div class="info-row"><span>框架</span><span>Electron {{ versions.electron }} + Vue3</span></div>
          <div class="info-row"><span>内核</span><span>Chrome {{ versions.chrome }}</span></div>
          <div class="info-row"><span>Node</span><span>{{ versions.node }}</span></div>
          <div class="info-row"><span>平台</span><span>{{ platformName }} {{ versions.arch }}</span></div>
        </div>
        <div class="about-links">
          <a href="https://github.com/relaxreader/relax-reader" target="_blank">项目主页</a>
          <span class="sep">·</span>
          <a href="https://github.com/relaxreader/relax-reader/issues" target="_blank">反馈问题</a>
          <span class="sep">·</span>
          <a href="https://github.com/relaxreader/relax-reader/releases" target="_blank">检查更新</a>
        </div>
      </section>

      <div class="s-spacer" />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useReaderStore } from '../store/reader.js'

const store = useReaderStore()

const versions = ref({ app: '1.0.0', electron: '', node: '', chrome: '', platform: '', arch: '' })
const platformMap = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }
const platformName = computed(() => platformMap[versions.value.platform] || versions.value.platform)

onMounted(async () => {
  try {
    const v = await window.electronAPI?.getVersions()
    if (v) versions.value = v
  } catch {}
})

const themes = [
  {
    key: 'light',
    label: '浅色',
    bg: '#faf8f5',
    fg: '#2c2416',
    preview: '纸白墨黑，清晰利落'
  },
  {
    key: 'dark',
    label: '深色',
    bg: '#1e1c19',
    fg: '#c8bda0',
    preview: '暗光环境，柔和护眼'
  },
  {
    key: 'sepia',
    label: '护眼',
    bg: '#f4ecd8',
    fg: '#5b4636',
    preview: '仿旧书卷，温润舒适'
  }
]

const fontFamilies = [
  { key: 'default', label: '系统默认' },
  { key: 'serif', label: '宋体' },
  { key: 'sans', label: '黑体' }
]

// Preview style reflects current settings
const fontMap = {
  default: 'system-ui, -apple-system, sans-serif',
  serif: '"Noto Serif SC", "Songti SC", Georgia, serif',
  sans: '"Noto Sans SC", "PingFang SC", sans-serif'
}

const previewStyle = computed(() => ({
  '--pv-bg': themes.find(t => t.key === store.settings.theme)?.bg || '#faf8f5',
  '--pv-fg': themes.find(t => t.key === store.settings.theme)?.fg || '#2c2416',
  fontSize: store.settings.fontSize + 'px',
  lineHeight: store.settings.lineHeight,
  fontFamily: fontMap[store.settings.fontFamily] || fontMap.default,
  maxWidth: store.settings.pageWidth + 'px',
  padding: `16px ${store.settings.marginH}px`
}))
</script>

<style scoped>
.settings {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-page, #f5f0e8);
  color: var(--text-primary, #2c2416);
  transition: background 0.4s, color 0.4s;
}

/* ── Header ── */
.s-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: var(--titlebar-h, 0px) 8px 0;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-light, rgba(0,0,0,0.06));
  -webkit-app-region: drag;
}
.s-header .btn-icon {
  -webkit-app-region: no-drag;
}
.s-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.btn-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: inherit;
  opacity: 0.55;
  transition: opacity 0.15s, background 0.15s;
}
.btn-icon:hover { opacity: 1; background: var(--surface-overlay, rgba(0,0,0,0.04)); }
.header-spacer { width: 36px; }

/* ── Body ── */
.s-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 0;
}

/* ── Preview card ── */
.preview-card {
  background: var(--pv-bg, #faf8f5);
  color: var(--pv-fg, #2c2416);
  border-radius: 14px;
  padding: 16px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: background 0.4s, color 0.4s, font-size 0.2s, line-height 0.2s;
  overflow: hidden;
}
.preview-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.4;
  margin-bottom: 8px;
  font-weight: 600;
}
.preview-text {
  text-align: justify;
  text-indent: 2em;
}

/* ── Setting block ── */
.setting-block {
  margin-bottom: 28px;
}
.block-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #8c7a6b);
  margin-bottom: 12px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.block-value {
  font-weight: 400;
  font-size: 12px;
  opacity: 0.6;
}

/* ── Theme cards ── */
.theme-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.theme-card {
  position: relative;
  aspect-ratio: 4 / 5;
  border-radius: 14px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 8px;
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.15s;
  font-family: inherit;
}
.theme-card:hover {
  transform: translateY(-2px);
}
.theme-card.active {
  border-color: var(--color-primary, #c96b2c);
  box-shadow: 0 0 0 3px rgba(201, 107, 44, 0.12);
}
.tc-text {
  font-size: 12px;
  text-align: center;
  line-height: 1.5;
  opacity: 0.7;
}
.tc-label {
  font-size: 13px;
  font-weight: 600;
}
.tc-check {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--color-primary, #c96b2c);
}

/* ── Font options ── */
.font-options {
  display: flex;
  gap: 8px;
}
.font-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 10px;
  border: 1.5px solid var(--border-light, rgba(0,0,0,0.08));
  background: var(--surface-card, #fff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: var(--text-primary, #2c2416);
  transition: all 0.2s;
}
.font-btn:hover {
  border-color: var(--color-primary-light, #e8925e);
}
.font-btn.active {
  border-color: var(--color-primary, #c96b2c);
  background: rgba(201, 107, 44, 0.06);
  color: var(--color-primary, #c96b2c);
}

/* ── Slider ── */
.slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.slider-icon {
  font-weight: 700;
  color: var(--text-tertiary, #b8a99a);
  line-height: 1;
  user-select: none;
}
.slider-icon--small { font-size: 14px; }
.slider-icon--large { font-size: 22px; }

/* ── Styled range input ── */
.styled-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-light, rgba(0,0,0,0.08));
  outline: none;
  cursor: pointer;
}
.styled-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--color-primary, #c96b2c);
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: box-shadow 0.15s;
}
.styled-slider::-webkit-slider-thumb:hover {
  box-shadow: 0 2px 8px rgba(201, 107, 44, 0.25);
}
.styled-slider::-webkit-slider-thumb:active {
  box-shadow: 0 0 0 6px rgba(201, 107, 44, 0.12);
}

/* ── Line height visual ── */
.lh-visual {
  display: flex;
  flex-direction: column;
  gap: calc((var(--lh) - 1) * 12px);
  padding: 8px 0;
  margin-bottom: 8px;
  transition: gap 0.2s;
}
.lh-line {
  display: block;
  height: 2px;
  border-radius: 1px;
  background: var(--border-light, rgba(0,0,0,0.08));
  transition: background 0.2s;
}

/* ── Spacer ── */
.s-spacer {
  height: 40px;
}

/* ── About card ── */
.about-card {
  background: var(--surface-card, #fff);
  border: 1px solid var(--border-light, rgba(0,0,0,0.06));
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 24px;
}
.about-logo {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}
.about-name h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #2c2416);
}
.about-version {
  font-size: 12px;
  color: var(--color-primary, #c96b2c);
  font-weight: 600;
}
.about-desc {
  font-size: 13px;
  color: var(--text-secondary, #8c7a6b);
  margin-bottom: 16px;
}
.about-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.info-row span:first-child {
  color: var(--text-tertiary, #b8a99a);
}
.info-row span:last-child {
  color: var(--text-secondary, #8c7a6b);
  font-family: 'SF Mono', 'Menlo', monospace;
}
.about-links {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.about-links a {
  color: var(--color-primary, #c96b2c);
  text-decoration: none;
}
.about-links a:hover {
  text-decoration: underline;
}
.about-links .sep {
  color: var(--text-tertiary, #b8a99a);
}
</style>
