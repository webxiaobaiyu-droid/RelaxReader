<template>
  <div class="se-backdrop" @click.self="$emit('close')">
    <div class="se-modal">
      <header class="se-header">
        <h3>{{ source ? '编辑书源' : '添加书源' }}</h3>
        <button class="se-close" @click="$emit('close')">✕</button>
      </header>

      <div class="se-body">
        <!-- ── Basic ── -->
        <section class="se-section">
          <h4>基本信息</h4>
          <div class="se-row">
            <label>名称<span class="req">*</span></label>
            <input v-model="form.name" placeholder="如：笔趣阁" />
          </div>
          <div class="se-row">
            <label>站点地址<span class="req">*</span></label>
            <input v-model="form.baseUrl" placeholder="https://example.com" />
          </div>
          <div class="se-row two-col">
            <div>
              <label>分组</label>
              <input v-model="form.group" placeholder="默认" />
            </div>
            <div>
              <label>优先级 ({{ form.priority }})</label>
              <input type="range" v-model.number="form.priority" min="0" max="100" />
            </div>
          </div>
        </section>

        <!-- ── Search ── -->
        <section class="se-section">
          <h4>搜索</h4>
          <div class="se-row two-col">
            <div>
              <label>方法</label>
              <select v-model="form.searchMethod">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div>
              <label>编码</label>
              <select v-model="form.charset">
                <option value="utf-8">utf-8</option>
                <option value="gbk">gbk</option>
              </select>
            </div>
          </div>
          <div class="se-row">
            <label>搜索 URL（{keyword} 为关键词占位符）</label>
            <input v-model="form.searchUrl" placeholder="https://example.com/search?q={keyword}" />
          </div>
          <div v-if="form.searchMethod === 'POST'" class="se-row">
            <label>POST 表单（key=value&...）</label>
            <input v-model="form.searchBody" placeholder="searchkey={keyword}" />
          </div>
          <div class="se-row">
            <label>备用搜索 URL（可选，主 URL 失败时尝试）</label>
            <input v-model="form.searchFallback" placeholder="https://example.com/search" />
          </div>
        </section>

        <!-- ── Selectors ── -->
        <section class="se-section">
          <h4>选择器</h4>
          <p class="se-hint">
            选择器格式：<code>tag.class@属性</code>。
            属性支持 <code>@text</code> / <code>@href</code> / <code>@src</code> / <code>@html</code> / <code>@content</code>（br 转换行）。
          </p>
          <div class="se-row">
            <label>书名</label>
            <input v-model="form.bookName" placeholder="#info h1@text" />
          </div>
          <div class="se-row">
            <label>封面</label>
            <input v-model="form.bookCover" placeholder="#fmimg img@src" />
          </div>
          <div class="se-row">
            <label>简介</label>
            <input v-model="form.bookDesc" placeholder="#intro p@text" />
          </div>
          <div class="se-row">
            <label>章节列表</label>
            <input v-model="form.chapterList" placeholder="#list dd a" />
          </div>
          <div class="se-row">
            <label>正文</label>
            <input v-model="form.content" placeholder="#content@content" />
          </div>
        </section>
      </div>

      <footer class="se-footer">
        <button class="se-btn ghost" @click="$emit('close')">取消</button>
        <button class="se-btn primary" :disabled="!canSave" @click="onSave">
          保存
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({ source: { type: Object, default: null } })
const emit = defineEmits(['close', 'save'])

const form = reactive({
  id: props.source?.id || '',
  name: props.source?.name || '',
  baseUrl: props.source?.baseUrl || '',
  group: props.source?.group || '默认',
  priority: props.source?.priority ?? 50,
  enabled: props.source?.enabled ?? true,
  searchMethod: props.source?.searchMethod || 'GET',
  searchUrl: props.source?.searchUrl || '',
  searchBody: props.source?.searchBody || '',
  searchFallback: props.source?.searchFallback || '',
  charset: props.source?.charset || 'utf-8',
  bookName: props.source?.bookName || '',
  bookCover: props.source?.bookCover || '',
  bookDesc: props.source?.bookDesc || '',
  chapterList: props.source?.chapterList || '',
  content: props.source?.content || ''
})

const canSave = computed(() => form.name.trim() && form.baseUrl.trim())

function onSave() {
  emit('save', { ...form })
}
</script>

<style scoped>
.se-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.42);
  z-index: 300; display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.se-modal {
  width: 540px; max-width: 100%; max-height: 90vh;
  background: var(--surface-card); border-radius: 14px;
  display: flex; flex-direction: column;
  box-shadow: 0 16px 40px rgba(0,0,0,0.28);
  overflow: hidden;
}
.se-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px 14px; border-bottom: 1px solid var(--border-light);
}
.se-header h3 { font-size: 15px; font-weight: 700; }
.se-close {
  width: 28px; height: 28px; border-radius: 50%; border: none;
  background: var(--surface-overlay); color: var(--text-secondary); cursor: pointer;
}
.se-close:hover { background: var(--border-light); color: var(--text-primary); }

.se-body {
  padding: 14px 22px; overflow-y: auto; flex: 1;
}
.se-section { margin-bottom: 18px; }
.se-section h4 {
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;
}
.se-hint {
  font-size: 11.5px; color: var(--text-tertiary); line-height: 1.6;
  margin-bottom: 12px;
  padding: 8px 10px; background: var(--surface-overlay); border-radius: 6px;
}
.se-hint code {
  font-family: ui-monospace, monospace; font-size: 11px;
  background: var(--surface-card); padding: 1px 4px; border-radius: 3px;
}

.se-row { margin-bottom: 10px; }
.se-row label {
  display: block; font-size: 12px; color: var(--text-secondary);
  margin-bottom: 4px;
}
.se-row .req { color: #cf222e; margin-left: 2px; }
.se-row input[type="text"],
.se-row input:not([type]),
.se-row select {
  width: 100%; padding: 7px 10px; font-size: 13px;
  background: var(--surface-page); color: var(--text-primary);
  border: 1px solid var(--border-light); border-radius: 6px;
  font-family: ui-monospace, monospace;
}
.se-row select { font-family: inherit; }
.se-row input:focus, .se-row select:focus {
  outline: none; border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(201,107,44,0.12);
}
.se-row input[type="range"] {
  width: 100%; accent-color: var(--color-primary); margin-top: 4px;
}
.se-row.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.se-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 22px; border-top: 1px solid var(--border-light);
}
.se-btn {
  padding: 7px 18px; font-size: 13px; font-weight: 600;
  border-radius: 7px; cursor: pointer; border: 1px solid transparent;
}
.se-btn.ghost { background: transparent; color: var(--text-secondary); }
.se-btn.ghost:hover { background: var(--surface-overlay); color: var(--text-primary); }
.se-btn.primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.se-btn.primary:hover:not(:disabled) { background: var(--color-primary-dark); }
.se-btn.primary:disabled { opacity: 0.5; cursor: default; }
</style>
