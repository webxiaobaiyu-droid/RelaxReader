<template>
  <teleport to="body">
    <div v-if="visible" class="aa-overlay" @click.self="$emit('close')">
      <div class="aa-panel">
        <!-- ═══ Theme presets ═══ -->
        <div class="aa-section">
          <div class="aa-label">主题</div>
          <div class="aa-themes">
            <button
              v-for="t in themes"
              :key="t.key"
              class="aa-theme-dot"
              :class="{ active: settings.theme === t.key }"
              :style="{ background: t.dot }"
              :title="t.label"
              @click="settings.theme = t.key"
            >
              <span class="aa-dot-label">{{ t.label }}</span>
            </button>
          </div>
        </div>

        <!-- ═══ Font family ═══ -->
        <div class="aa-section">
          <div class="aa-label">字体</div>
          <div class="aa-segmented">
            <button
              v-for="f in fonts"
              :key="f.key"
              class="aa-seg-btn"
              :class="{ active: settings.fontFamily === f.key }"
              @click="settings.fontFamily = f.key"
            >{{ f.label }}</button>
          </div>
        </div>

        <!-- ═══ Font size ═══ -->
        <div class="aa-section">
          <div class="aa-label">字号</div>
          <div class="aa-slider-row">
            <span class="aa-slider-icon aa-slider-icon--s">A</span>
            <input
              type="range"
              min="12" max="32" step="1"
              :value="settings.fontSize"
              @input="settings.fontSize = +$event.target.value"
            />
            <span class="aa-slider-icon aa-slider-icon--l">A</span>
          </div>
        </div>

        <!-- ═══ Line height ═══ -->
        <div class="aa-section">
          <div class="aa-label">
            行间距
            <span class="aa-val">{{ settings.lineHeight.toFixed(1) }}</span>
          </div>
          <input
            type="range"
            min="1.4" max="2.8" step="0.1"
            :value="settings.lineHeight"
            @input="settings.lineHeight = +$event.target.value"
          />
        </div>

        <!-- ═══ Page width ═══ -->
        <div class="aa-section">
          <div class="aa-label">
            内容宽度
            <span class="aa-val">{{ settings.pageWidth }}px</span>
          </div>
          <input
            type="range"
            min="480" max="960" step="20"
            :value="settings.pageWidth"
            @input="settings.pageWidth = +$event.target.value"
          />
        </div>

        <!-- ═══ Margin ═══ -->
        <div class="aa-section">
          <div class="aa-label">
            页边距
            <span class="aa-val">{{ settings.marginH }}px</span>
          </div>
          <input
            type="range"
            min="16" max="64" step="4"
            :value="settings.marginH"
            @input="settings.marginH = +$event.target.value"
          />
        </div>

        <!-- ═══ Reading mode ═══ -->
        <div class="aa-section">
          <div class="aa-label">翻页方式</div>
          <div class="aa-segmented">
            <button
              class="aa-seg-btn"
              :class="{ active: settings.readingMode === 'scroll' }"
              @click="settings.readingMode = 'scroll'"
            >滚动</button>
            <button
              class="aa-seg-btn"
              :class="{ active: settings.readingMode === 'slide' }"
              @click="settings.readingMode = 'slide'"
            >滑动</button>
            <button
              class="aa-seg-btn"
              :class="{ active: settings.readingMode === 'paged' }"
              @click="settings.readingMode = 'paged'"
            >翻页</button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { useReaderStore } from '../store/reader.js'

defineProps({
  visible: { type: Boolean, default: false }
})
defineEmits(['close'])

const store = useReaderStore()
const settings = store.settings

const themes = [
  { key: 'light', label: '浅色', dot: '#f5f0e8' },
  { key: 'dark', label: '深色', dot: '#1a1814' },
  { key: 'sepia', label: '护眼', dot: '#f4ecd8' }
]

const fonts = [
  { key: 'default', label: '默认' },
  { key: 'serif', label: '宋体' },
  { key: 'sans', label: '黑体' }
]
</script>

<style scoped>
.aa-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.aa-panel {
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  padding: 20px 22px;
  width: 320px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.aa-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.aa-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.aa-val {
  font-weight: 400;
  opacity: 0.5;
  font-size: 11px;
}

/* ── Theme dots ── */
.aa-themes {
  display: flex;
  gap: 10px;
}
.aa-theme-dot {
  flex: 1;
  aspect-ratio: 1.6;
  border-radius: 10px;
  border: 2px solid transparent;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.aa-theme-dot:hover {
  border-color: var(--color-primary-light);
}
.aa-theme-dot.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(201,107,44,0.12);
}
.aa-dot-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(0,0,0,0.35);
}

/* ── Segmented control ── */
.aa-segmented {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-light);
}
.aa-seg-btn {
  flex: 1;
  padding: 7px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-secondary);
  border-right: 1px solid var(--border-light);
  transition: background 0.15s, color 0.15s;
}
.aa-seg-btn:last-child { border-right: none; }
.aa-seg-btn:hover { background: var(--surface-overlay); }
.aa-seg-btn.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

/* ── Sliders ── */
.aa-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.aa-slider-icon {
  font-weight: 700;
  color: var(--text-tertiary);
  line-height: 1;
}
.aa-slider-icon--s { font-size: 13px; }
.aa-slider-icon--l { font-size: 20px; }

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: var(--border-light);
  outline: none;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--color-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  cursor: pointer;
}
</style>
