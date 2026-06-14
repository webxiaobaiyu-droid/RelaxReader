<template>
  <transition name="sm-fade">
    <div v-if="visible" class="sm-backdrop" @click.self="close">
      <transition name="sm-slide">
        <aside v-if="visible" class="sm-drawer">
          <!-- ── Header ── -->
          <header class="sm-header">
            <div class="sm-title">
              <h2>书源管理</h2>
              <span class="sm-sub">{{ enabledCount }} / {{ sources.length }} 已启用</span>
            </div>
            <button class="sm-close" @click="close" title="关闭">✕</button>
          </header>

          <!-- ── Toolbar ── -->
          <div class="sm-toolbar">
            <button class="sm-tool-btn primary" @click="openEditor()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              添加书源
            </button>
            <button class="sm-tool-btn" @click="refreshAll" :disabled="testingAll">
              {{ testingAll ? '测试中...' : '一键测试' }}
            </button>
            <div class="sm-tool-spacer" />
            <button class="sm-tool-btn ghost" @click="onImport">导入</button>
            <button class="sm-tool-btn ghost" @click="onExport">导出</button>
            <button class="sm-tool-btn ghost danger" @click="onResetAll">重置</button>
          </div>

          <!-- ── List ── -->
          <div class="sm-list">
            <div v-if="sources.length === 0" class="sm-empty">
              暂无书源。点击「添加书源」开始。
            </div>

            <article
              v-for="s in sortedSources"
              :key="s.id"
              class="sm-row"
              :class="{ disabled: !s.enabled }"
            >
              <!-- Toggle -->
              <label class="sm-switch" @click.stop>
                <input type="checkbox" :checked="s.enabled" @change="onToggle(s)" />
                <span class="sm-switch-slider" />
              </label>

              <!-- Identity -->
              <div class="sm-row-main" @click="openEditor(s)">
                <div class="sm-row-line1">
                  <span class="sm-row-name">{{ s.name }}</span>
                  <span v-if="s.builtin" class="sm-tag builtin">内置</span>
                  <span class="sm-tag" :class="'h-' + s.health.status">{{ healthLabel(s) }}</span>
                </div>
                <div class="sm-row-line2">
                  <span class="sm-host">{{ hostOf(s.baseUrl) }}</span>
                  <span v-if="s.health.avgLatencyMs != null" class="sm-meta">{{ s.health.avgLatencyMs }}ms</span>
                  <span v-if="s.health.lastError" class="sm-meta error" :title="s.health.lastError">{{ truncate(s.health.lastError, 28) }}</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="sm-row-actions" @click.stop>
                <button class="sm-icon-btn" @click="onTest(s)" :disabled="testing[s.id]" title="测试">
                  <svg v-if="!testing[s.id]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span v-else class="sm-spin-small" />
                </button>
                <button class="sm-icon-btn" @click="openEditor(s)" title="编辑">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="sm-icon-btn danger" @click="onDelete(s)" title="删除">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </article>
          </div>

          <!-- ── Editor modal ── -->
          <SourceEditor
            v-if="editorOpen"
            :source="editingSource"
            @close="editorOpen = false"
            @save="onEditorSave"
          />

          <!-- ═══ Import Dialog ═══ -->
          <div v-if="importDialog.show" class="sm-backdrop-inner" @click.self="importDialog.show = false">
            <div class="sm-import-dialog">
              <h3>导入书源</h3>
              <p class="sm-import-info">共 {{ importDialog.total }} 个书源</p>

              <!-- Testing progress -->
              <div v-if="importDialog.testing" class="sm-import-progress">
                <div class="sm-import-bar">
                  <div class="sm-import-fill" :style="{ width: importDialog.progress + '%' }" />
                </div>
                <span class="sm-import-pct">{{ importDialog.progress }}%</span>
              </div>

              <!-- Results log -->
              <div v-if="importDialog.results.length > 0" class="sm-import-log">
                <div
                  v-for="r in importDialog.results.slice(-20)"
                  :key="r.name"
                  class="sm-import-log-item"
                  :class="{ ok: r.ok, fail: !r.ok }"
                >
                  <span class="sm-import-dot">{{ r.ok ? '✓' : '✗' }}</span>
                  <span class="sm-import-log-name">{{ r.name }}</span>
                  <span v-if="!r.ok" class="sm-import-log-err">{{ r.error }}</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="sm-import-actions" v-if="!importDialog.testing">
                <input v-model="importKeyword" class="sm-import-kw" placeholder="测试关键词" />
                <button class="se-btn ghost" @click="importDialog.show = false">取消</button>
                <button class="se-btn ghost" @click="doFastImport">快速导入</button>
                <button class="se-btn primary" @click="doVerifiedImport">验证后导入</button>
              </div>
            </div>
          </div>
        </aside>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import SourceEditor from './SourceEditor.vue'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close', 'changed'])
const toast = inject('toast')

const sources = ref([])
const testing = ref({})         // { sourceId: bool }
const testingAll = ref(false)
const editorOpen = ref(false)
const editingSource = ref(null)

async function onResetAll() {
  if (!confirm('确定要重置为默认书源吗？所有自定义源将被删除，内置源恢复默认配置。')) return
  const res = await window.electronAPI?.resetAllSources()
  if (res?.success) {
    await load()
    emit('changed')
    toast?.success('已重置为默认书源')
  } else {
    toast?.error(res?.error || '重置失败')
  }
}



const enabledCount = computed(() => sources.value.filter(s => s.enabled).length)
const sortedSources = computed(() => {
  // Enabled first, then by priority desc, then by name
  return [...sources.value].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0)
    return a.name.localeCompare(b.name, 'zh-CN')
  })
})

watch(() => props.visible, (v) => { if (v) load() })

async function load() {
  const res = await window.electronAPI?.listSources()
  if (res?.success) sources.value = res.data || []
}

function close() { emit('close') }
function hostOf(url) { try { return new URL(url).host } catch { return url } }
function truncate(s, n) { return !s ? '' : (s.length > n ? s.slice(0, n) + '...' : s) }
function healthLabel(s) {
  if (s.health.status === 'ok') return '正常'
  if (s.health.status === 'fail') return '异常'
  return '未测试'
}

async function onToggle(s) {
  const enabled = !s.enabled
  const res = await window.electronAPI?.toggleSource(s.id, enabled)
  if (res?.success) { s.enabled = enabled; emit('changed') }
  else toast?.error(res?.error || '保存失败')
}

async function onTest(s) {
  testing.value[s.id] = true
  try {
    const res = await window.electronAPI?.testSource(s.id, '剑')
    if (res?.success) toast?.success(`${s.name} 正常（${res.data.count}条 / ${res.data.latencyMs}ms）`)
    else toast?.error(`${s.name} 异常：${res?.error || '未知错误'}`)
  } finally {
    testing.value[s.id] = false
    await load()
  }
}

async function refreshAll() {
  if (testingAll.value) return
  testingAll.value = true
  try {
    await Promise.all(sources.value.map(async (s) => {
      testing.value[s.id] = true
      try { await window.electronAPI?.testSource(s.id, '剑') }
      finally { testing.value[s.id] = false }
    }))
  } finally {
    testingAll.value = false
    await load()
    toast?.success('测试完成')
  }
}

async function onDelete(s) {
  if (!confirm(`确定删除「${s.name}」？`)) return
  const res = await window.electronAPI?.deleteSource(s.id)
  if (res?.success) { await load(); emit('changed'); toast?.success('已删除') }
  else toast?.error(res?.error || '删除失败')
}

function openEditor(s = null) {
  editingSource.value = s ? { ...s } : null
  editorOpen.value = true
}

async function onEditorSave(payload) {
  const res = await window.electronAPI?.saveSource(payload)
  if (res?.success) {
    editorOpen.value = false
    await load()
    emit('changed')
    toast?.success('已保存')
  } else {
    toast?.error(res?.error || '保存失败')
  }
}

async function onExport() {
  const res = await window.electronAPI?.exportSources()
  if (!res?.success) { toast?.error(res?.error || '导出失败'); return }
  const json = JSON.stringify(res.data, null, 2)
  // Use blob+download — no file system dialog needed in renderer
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relax-reader-sources-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function onImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const sourcesToImport = Array.isArray(data) ? data : (data.sources || [data])
      if (sourcesToImport.length === 0) { toast?.error('未找到有效的书源'); return }

      // Show choice dialog
      showImportDialog(sourcesToImport)
    } catch (e) {
      toast?.error('文件解析失败：' + e.message)
    }
  }
  input.click()
}

// ── Import dialog state ──
const importDialog = ref({ show: false, sources: [], testing: false, progress: 0, total: 0, results: [] })
const importKeyword = ref('剑来')

function showImportDialog(sources) {
  importDialog.value = { show: true, sources, testing: false, progress: 0, total: sources.length, results: [] }
}

async function doFastImport() {
  const sources = importDialog.value.sources
  importDialog.value.show = false
  const res = await window.electronAPI?.importSources(sources)
  if (res?.success) {
    await load(); emit('changed')
    toast?.success(`已导入 ${res.imported} 个书源`)
  } else {
    toast?.error(res?.error || '导入失败')
  }
}

async function doVerifiedImport() {
  const sources = importDialog.value.sources
  const total = sources.length
  importDialog.value.testing = true
  importDialog.value.progress = 0
  importDialog.value.results = []

  // Test in batches of 5 concurrently
  const BATCH = 5
  const passing = []
  for (let i = 0; i < sources.length; i += BATCH) {
    const batch = sources.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      batch.map(s => window.electronAPI?.testSource(s.id, importKeyword.value))
    )
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j]
      const src = batch[j]
      if (r.status === 'fulfilled' && r.value?.success) {
        passing.push(src)
        importDialog.value.results.push({ name: src.name, ok: true })
      } else {
        importDialog.value.results.push({
          name: src.name,
          ok: false,
          error: r.status === 'fulfilled' ? (r.value?.error || '失败') : r.reason?.message || '请求失败'
        })
      }
      importDialog.value.progress = Math.round(((i + j + 1) / total) * 100)
    }
  }

  importDialog.value.testing = false

  // Import only passing sources
  if (passing.length === 0) {
    toast?.error('没有可用的书源')
    importDialog.value.show = false
    return
  }

  const res = await window.electronAPI?.importSources(passing)
  importDialog.value.show = false
  if (res?.success) {
    await load(); emit('changed')
    toast?.success(`已导入 ${res.imported} 个书源（${total - res.imported} 个失败）`)
  } else {
    toast?.error(res?.error || '导入失败')
  }
}
</script>

<style scoped>
.sm-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.32);
  backdrop-filter: blur(4px); z-index: 200;
  display: flex; justify-content: flex-end;
}
.sm-drawer {
  width: 480px; max-width: 100vw; height: 100vh;
  background: var(--surface-page); display: flex; flex-direction: column;
  box-shadow: -8px 0 32px rgba(0,0,0,0.18);
}

/* Animations */
.sm-fade-enter-active, .sm-fade-leave-active { transition: opacity 0.22s; }
.sm-fade-enter-from, .sm-fade-leave-to { opacity: 0; }
.sm-slide-enter-active, .sm-slide-leave-active { transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
.sm-slide-enter-from, .sm-slide-leave-to { transform: translateX(100%); }

/* Header */
.sm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 24px 14px; flex-shrink: 0;
}
.sm-title h2 { font-size: 18px; font-weight: 700; }
.sm-sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; display: block; }
.sm-close {
  width: 30px; height: 30px; border-radius: 50%; border: none;
  background: var(--surface-overlay); color: var(--text-secondary);
  cursor: pointer; font-size: 13px;
}
.sm-close:hover { background: var(--border-light); color: var(--text-primary); }

/* Toolbar */
.sm-toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 0 24px 14px; flex-shrink: 0;
}
.sm-tool-spacer { flex: 1; }
.sm-tool-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; font-size: 12px; font-weight: 600;
  border-radius: 7px; border: 1px solid var(--border-light);
  background: var(--surface-card); color: var(--text-primary);
  cursor: pointer; transition: all 0.15s;
}
.sm-tool-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.sm-tool-btn:disabled { opacity: 0.5; cursor: default; }
.sm-tool-btn.primary {
  background: var(--color-primary); color: #fff; border-color: var(--color-primary);
}
.sm-tool-btn.primary:hover { background: var(--color-primary-dark); border-color: var(--color-primary-dark); color: #fff; }
.sm-tool-btn.ghost { background: transparent; border-color: transparent; color: var(--text-secondary); }
.sm-tool-btn.ghost:hover { background: var(--surface-overlay); color: var(--text-primary); }
.sm-tool-btn.ghost.danger:hover { background: rgba(207,34,46,0.08); color: #cf222e; }

/* ── Import dialog ── */
.sm-backdrop-inner {
  position: fixed; inset: 0; background: rgba(0,0,0,0.42);
  z-index: 500; display: flex; align-items: center; justify-content: center;
}
.sm-import-dialog {
  width: 460px; max-width: 90vw; max-height: 80vh;
  background: var(--surface-card); border-radius: 14px;
  padding: 22px 24px; display: flex; flex-direction: column;
  box-shadow: 0 16px 40px rgba(0,0,0,0.28);
}
.sm-import-dialog h3 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.sm-import-info { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }

.sm-import-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sm-import-bar { flex: 1; height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden; }
.sm-import-fill { height: 100%; background: var(--color-primary); border-radius: 3px; transition: width 0.3s; }
.sm-import-pct { font-size: 12px; color: var(--text-secondary); min-width: 36px; text-align: right; }

.sm-import-log { max-height: 320px; overflow-y: auto; margin-bottom: 16px; }
.sm-import-log-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 0; font-size: 11px;
}
.sm-import-dot { width: 14px; flex-shrink: 0; font-weight: 700; }
.sm-import-log-item.ok .sm-import-dot { color: #2ea043; }
.sm-import-log-item.fail .sm-import-dot { color: #cf222e; }
.sm-import-log-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.sm-import-log-err { color: #cf222e; opacity: 0.7; font-size: 10px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sm-import-actions { display: flex; align-items: center; gap: 8px; }
.sm-import-kw {
  padding: 6px 10px; font-size: 12px; border: 1px solid var(--border-light);
  border-radius: 6px; background: var(--surface-page); color: var(--text-primary);
  width: 100px;
}
.sm-import-kw:focus { outline: none; border-color: var(--color-primary); }
.sm-import-actions .se-btn { padding: 7px 16px; font-size: 13px; font-weight: 600; border-radius: 7px; cursor: pointer; border: none; }
.sm-import-actions .se-btn.ghost { background: transparent; color: var(--text-secondary); }
.sm-import-actions .se-btn.primary { background: var(--color-primary); color: #fff; }

/* List */
.sm-list {
  flex: 1; overflow-y: auto; padding: 0 16px 24px;
}
.sm-empty {
  padding: 60px 24px; text-align: center;
  color: var(--text-tertiary); font-size: 13px;
}

.sm-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; margin-bottom: 6px;
  background: var(--surface-card); border-radius: 10px;
  transition: background 0.12s, opacity 0.12s;
}
.sm-row:hover { background: var(--surface-overlay); }
.sm-row.disabled { opacity: 0.55; }

.sm-row-main { flex: 1; min-width: 0; cursor: pointer; }
.sm-row-line1 { display: flex; align-items: center; gap: 6px; }
.sm-row-name { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.sm-row-line2 {
  display: flex; align-items: center; gap: 10px; margin-top: 3px;
  font-size: 11px; color: var(--text-tertiary);
}
.sm-host { font-family: ui-monospace, SFMono-Regular, monospace; }
.sm-meta {}
.sm-meta.error { color: #c44; }

/* Tags */
.sm-tag {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--surface-overlay); color: var(--text-secondary);
  line-height: 1.5;
}
.sm-tag.builtin { background: rgba(201,107,44,0.12); color: var(--color-primary); }
.sm-tag.h-ok { background: rgba(46,160,67,0.14); color: #2ea043; }
.sm-tag.h-fail { background: rgba(207,34,46,0.14); color: #cf222e; }
.sm-tag.h-unknown { background: var(--surface-overlay); color: var(--text-tertiary); }

/* Switch */
.sm-switch {
  position: relative; width: 36px; height: 20px; flex-shrink: 0; cursor: pointer;
}
.sm-switch input { opacity: 0; width: 0; height: 0; }
.sm-switch-slider {
  position: absolute; inset: 0; background: var(--border-light); border-radius: 20px;
  transition: background 0.18s;
}
.sm-switch-slider::before {
  content: ''; position: absolute; height: 16px; width: 16px; left: 2px; top: 2px;
  background: #fff; border-radius: 50%; transition: transform 0.18s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.18);
}
.sm-switch input:checked + .sm-switch-slider { background: var(--color-primary); }
.sm-switch input:checked + .sm-switch-slider::before { transform: translateX(16px); }

/* Row actions */
.sm-row-actions { display: flex; gap: 2px; flex-shrink: 0; }
.sm-icon-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); transition: background 0.12s, color 0.12s;
}
.sm-icon-btn:hover { background: var(--border-light); color: var(--text-primary); }
.sm-icon-btn.danger:hover { background: rgba(207,34,46,0.12); color: #cf222e; }
.sm-icon-btn:disabled { opacity: 0.4; cursor: default; }

.sm-spin-small {
  width: 12px; height: 12px; border: 1.5px solid var(--border-light);
  border-top-color: var(--color-primary); border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

</style>
