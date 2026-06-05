<template>
  <div class="book-card" @click="$emit('open', book)" @contextmenu="$emit('contextmenu', $event)">
    <div class="cover-wrap">
      <!-- Generated cover: first char of title on colored bg -->
      <div
        v-if="!book.cover"
        class="cover-placeholder"
        :style="{ background: gradient }"
      >
        <span class="cover-char">{{ book.title?.charAt(0) || '📖' }}</span>
      </div>
      <img v-else :src="book.cover" class="cover-img" />

      <!-- Progress badge -->
      <div v-if="book.progress > 0 && book.progress < 100" class="progress-badge">
        {{ book.progress }}%
      </div>
    </div>

    <div class="meta">
      <h3 class="title" :title="book.title">{{ book.title }}</h3>
      <p class="author">{{ book.author }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  book: { type: Object, required: true }
})

defineEmits(['open'])

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
</style>
