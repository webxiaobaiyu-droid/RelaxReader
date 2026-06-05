<template>
  <teleport to="body">
    <div class="ctx-backdrop" v-if="visible" @click="$emit('close')" @contextmenu.prevent="$emit('close')" />
    <div
      v-if="visible"
      class="ctx-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
    >
      <button
        v-for="item in items"
        :key="item.key"
        class="ctx-item"
        :class="{ danger: item.danger }"
        @click="handleClick(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] }
})
const emit = defineEmits(['action', 'close'])

function handleClick(item) {
  emit('action', item.key)
  emit('close')
}
</script>

<style scoped>
.ctx-backdrop { position: fixed; inset: 0; z-index: 99; }
.ctx-menu {
  position: fixed; z-index: 100;
  background: var(--surface-card);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 4px; min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.ctx-item {
  display: block; width: 100%;
  padding: 8px 14px; border: none; background: transparent;
  font-size: 13px; cursor: pointer; text-align: left;
  border-radius: 6px; color: var(--text-primary);
  transition: background 0.1s;
}
.ctx-item:hover { background: var(--surface-overlay); }
.ctx-item.danger { color: #d94535; }
.ctx-item.danger:hover { background: rgba(217,69,53,0.08); }
</style>
