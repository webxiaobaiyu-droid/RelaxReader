<template>
  <div class="book-card" @click="$emit('open', book)" @contextmenu="$emit('contextmenu', $event)">
    <div class="cover-wrap">
      <!-- Generated cover: first char of title on colored bg -->
      <div
        v-if="!displayCover || coverFailed"
        class="cover-placeholder"
        :style="{ background: gradient }"
      >
        <span class="cover-char">{{ book.title?.charAt(0) || '📖' }}</span>
      </div>
      <img v-else :src="displayCover" class="cover-img" @error="coverFailed = true" />

      <!-- Progress badge -->
      <div v-if="book.progress > 0 && book.progress < 100" class="progress-badge">
        {{ book.progress }}%
      </div>
      <div class="format-badge">{{ book.format === 'online' ? '在线' : '本地' }}</div>
    </div>

    <div class="meta">
      <h3 class="title" :title="book.title">{{ book.title }}</h3>
      <p class="author">{{ book.author }}</p>
      <div class="book-status">
        <span>{{ progressText }}</span>
        <span v-if="book.bookmarks?.length">{{ book.bookmarks.length }} 书签</span>
      </div>
      <div v-if="book.format === 'online'" class="cache-row" :title="cacheTitle">
        <span class="cache-bar"><i :style="{ width: cachePct + '%' }" /></span>
        <span>{{ book.cachedChapters || 0 }}/{{ book.totalChapters || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  book: { type: Object, required: true }
})

defineEmits(['open', 'contextmenu'])

const coverFailed = ref(false)

// Generate a stable gradient from book title
const palettes = [
  ['#f0c27f', '#8b5a2b'],
  ['#a8c0ff', '#3f4b8c'],
  ['#f7971e', '#7d3c00'],
  ['#c9d6ff', '#4a5899'],
  ['#e6b980', '#8e5e3a'],
  ['#d4a574', '#6d4c2e'],
  ['#b8d8d8', '#4a7c7c'],
  ['#f5af19', '#8e5a00'],
]

const gradient = computed(() => {
  const idx = (props.book.title || '').length % palettes.length
  const [a, b] = palettes[idx]
  return `linear-gradient(135deg, ${a}, ${b})`
})

const displayCover = computed(() => normalizeCoverUrl(props.book.cover, props.book.bookUrl))

watch(() => props.book.cover, () => {
  coverFailed.value = false
})

function normalizeCoverUrl(cover, bookUrl) {
  if (!cover || typeof cover !== 'string') return ''
  const trimmed = cover.trim()
  if (!trimmed || trimmed.startsWith('data:')) return trimmed
  try {
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (trimmed.startsWith('//')) {
      const protocol = bookUrl ? new URL(bookUrl).protocol : 'https:'
      return `${protocol}${trimmed}`
    }
    if (bookUrl) return new URL(trimmed, bookUrl).href
  } catch {}
  return trimmed
}

const progressText = computed(() => {
  if (props.book.progress >= 100) return '已读完'
  if (props.book.lastChapter != null && props.book.totalChapters) {
    return `读到 ${Math.min(props.book.lastChapter + 1, props.book.totalChapters)}/${props.book.totalChapters} 章`
  }
  return `${props.book.totalChapters || 0} 章`
})

const cachePct = computed(() => {
  if (!props.book.totalChapters) return 0
  return Math.min(100, Math.round(((props.book.cachedChapters || 0) / props.book.totalChapters) * 100))
})

const cacheTitle = computed(() => {
  const size = props.book.cacheSize || 0
  const label = size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(size / 1024)} KB`
  return `已缓存 ${props.book.cachedChapters || 0} 章 · ${label}`
})
</script>

<style scoped>
.book-card {
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.book-card:hover {
  transform: translateY(-6px);
}
.book-card:active {
  transform: scale(0.97);
}

/* ── Cover ── */
.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.book-card:hover .cover-wrap {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.08);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-char {
  font-size: 48px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  user-select: none;
}

/* ── Progress badge ── */
.progress-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.format-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  color: rgba(44, 36, 22, 0.78);
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
}

/* ── Meta ── */
.meta {
  padding: 10px 4px 0;
}
.title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary, #2c2416);
}
.author {
  font-size: 12px;
  color: var(--text-secondary, #8c7a6b);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.book-status {
  display: flex;
  gap: 8px;
  margin-top: 7px;
  font-size: 11px;
  color: var(--text-tertiary, #b8a99a);
  white-space: nowrap;
  overflow: hidden;
}
.book-status span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.cache-row {
  margin-top: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--text-tertiary);
}
.cache-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--surface-overlay);
  overflow: hidden;
}
.cache-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2ea043;
}
</style>
