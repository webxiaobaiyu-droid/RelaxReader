<template>
  <div class="skel">
    <div class="skel-line" v-for="i in lines" :key="i" :style="{ width: widths[i % widths.length] }" />
  </div>
</template>

<script setup>
defineProps({
  lines: { type: Number, default: 12 },
  widths: { type: Array, default: () => ['100%', '92%', '97%', '85%', '95%', '78%', '100%', '90%'] }
})
</script>

<style scoped>
.skel { display: flex; flex-direction: column; gap: 12px; padding: 24px; }
.skel-line {
  height: 14px; border-radius: 7px;
  background: linear-gradient(90deg, var(--border-light) 25%, var(--surface-overlay) 50%, var(--border-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
