/**
 * Book source registry — single source of truth for all book sources.
 *
 * A source is a plain object describing how to search/parse a novel site.
 * Sources are persisted to electron-store under the `sources` key. On first
 * launch we seed the store from the built-in defaults so the user starts
 * with something working out of the box; afterwards the store wins.
 *
 * Each source carries:
 *   - id, name, baseUrl, group, enabled, priority   (user-facing config)
 *   - searchUrl/searchMethod/... and content selectors  (scraper recipe)
 *   - builtin: true     → user can disable/edit but not delete
 *   - health: { status, lastTestedAt, lastError, successCount, failCount }
 *
 * Health is updated by searcher.js as a side effect of real traffic; the
 * Test button in the UI also calls updateHealth() with an explicit probe.
 */

import libStore from '../store.js'
import { builtinSources } from './builtin.js'

const STORE_KEY = 'sources'

// ── Schema defaults — applied when reading from store ──
function withDefaults(source) {
  return {
    enabled: true,
    priority: 50,
    group: '默认',
    builtin: false,
    health: {
      status: 'unknown',     // 'ok' | 'fail' | 'unknown'
      lastTestedAt: null,
      lastError: null,
      successCount: 0,
      failCount: 0,
      avgLatencyMs: null
    },
    ...source
  }
}

/**
 * Sync built-in sources on every launch.
 * - New builtins are added
 * - Existing builtins get config fields updated from builtin.js (searchUrl, selectors...)
 * - User preferences (enabled, priority, health) are preserved
 * - Non-builtin (custom) sources are removed (keeps the list clean)
 * - Dropped builtins are cleaned up
 */
let _synced = false

function syncBuiltins() {
  const existing = libStore.get(STORE_KEY, [])
  if (!Array.isArray(existing)) existing = []

  // Merge builtins into existing list — keep all non-builtin sources
  const builtinIds = new Set(builtinSources.map(s => s.id))
  const others = existing.filter(s => !builtinIds.has(s.id))

  const result = []
  for (const builtin of builtinSources) {
    const prev = existing.find(s => s.id === builtin.id)
    // For existing builtins: keep enabled/priority/health from store
    // For new builtins: use defaults
    const merged = prev
      ? { ...withDefaults(builtin), builtin: true, enabled: prev.enabled, priority: prev.priority, health: prev.health }
      : { ...withDefaults(builtin), builtin: true }
    result.push(merged)
  }

  libStore.set(STORE_KEY, [...result, ...others])
  _synced = true
}

/** Get every source the user has, applying defaults. */
export function listSources() {
  if (!_synced) syncBuiltins()
  const raw = libStore.get(STORE_KEY, [])
  return raw.map(withDefaults)
}

/** Only enabled sources, sorted by priority desc (higher = tried first). */
export function listEnabledSources() {
  return listSources()
    .filter(s => s.enabled)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export function getSource(id) {
  return listSources().find(s => s.id === id) ?? null
}

/** Upsert a source. Generates an id for new entries. */
export function upsertSource(source) {
  const all = listSources()
  const idx = all.findIndex(s => s.id === source.id)
  if (idx >= 0) {
    // Preserve builtin flag and existing health
    all[idx] = withDefaults({
      ...all[idx],
      ...source,
      builtin: all[idx].builtin,
      health: source.health ?? all[idx].health
    })
  } else {
    const id = source.id || `custom-${Date.now().toString(36)}`
    all.push(withDefaults({ ...source, id, builtin: false }))
  }
  libStore.set(STORE_KEY, all)
  return all.find(s => s.id === (source.id || all[all.length - 1].id))
}

/** Remove a source. Built-in sources cannot be removed, only disabled. */
export function removeSource(id) {
  const all = listSources()
  const target = all.find(s => s.id === id)
  if (!target) return { success: false, error: '书源不存在' }
  libStore.set(STORE_KEY, all.filter(s => s.id !== id))
  return { success: true }
}

/**
 * Convert a legado-format book source to our internal format.
 * Legado uses bookSourceUrl/ruleSearchUrl etc.; we use baseUrl/searchUrl etc.
 * See https://github.com/gedoor/legado for the canonical schema.
 */
export function convertLegadoSource(ls) {
  // Map legado field names → our field names
  const mapped = {
    id: ls.bookSourceUrl ? (ls.bookSourceName || ls.bookSourceUrl).replace(/[^a-z0-9]/gi, '').slice(0, 20) : (ls.id || ''),
    name: ls.bookSourceName || ls.name || '',
    baseUrl: ls.bookSourceUrl || ls.baseUrl || '',
    group: ls.bookSourceGroup || ls.group || '导入',
    enabled: ls.enabled ?? true,
    // searchUrl: legado stores it as `searchUrl` (not ruleSearchUrl), uses {{key}} placeholder
    searchUrl: simplifyLegadoUrl(ls.searchUrl || ls.ruleSearchUrl || ''),
    searchMethod: (ls.searchUrl || '').includes('searchkey') || (ls.ruleSearchUrl || '').includes('searchkey') ? 'POST' : 'GET',
    searchBody: (ls.searchUrl || '').includes('searchkey') || (ls.ruleSearchUrl || '').includes('searchkey') ? 'searchkey={keyword}' : '',
    charset: ls.charset || 'utf-8',
    // Selectors — simplify legado syntax for our parser
    bookName: simplifyLegadoSelector(ls.ruleBookInfo?.name || ls.ruleBookName || ls.bookName || ''),
    bookCover: simplifyLegadoSelector(ls.ruleBookInfo?.coverUrl || ls.ruleBookCover || ls.bookCover || ''),
    bookDesc: simplifyLegadoSelector(ls.ruleBookInfo?.intro || ls.ruleBookIntro || ls.bookDesc || ''),
    chapterList: simplifyLegadoSelector(ls.ruleToc?.chapterList || ls.ruleChapterList || ls.chapterList || ''),
    chapterTitle: simplifyLegadoSelector(ls.ruleToc?.chapterName || ls.ruleChapterName || ls.chapterTitle || ''),
    chapterUrl: simplifyLegadoSelector(ls.ruleToc?.chapterUrl || ls.ruleContentUrl || ls.chapterUrl || ''),
    // content: keep full rule including @textNodes, ##regex
    content: ls.ruleContent?.content || ls.content || '',
    // search rules from legado
    searchList: simplifyLegadoSelector(ls.ruleSearch?.bookList || ''),
    searchName: simplifyLegadoSelector(ls.ruleSearch?.name || ''),
    searchAuthor: simplifyLegadoSelector(ls.ruleSearch?.author || ''),
    searchCover: simplifyLegadoSelector(ls.ruleSearch?.coverUrl || ''),
    nextChapterUrl: ls.ruleContent?.nextContentUrl || ''
  }
  return mapped
}

/**
 * Simplify legado URL — resolve relative paths, replace {{key}} → {keyword}.
 */
function simplifyLegadoUrl(url) {
  if (!url) return ''
  return url.replace('{{key}}', '{keyword}').replace('{{page}}', '1')
}

/**
 * Simplify legado selector syntax to basic CSS our parser can handle.
 *   tag.h3.0@tag.a.0@text  →  h3 a@text
 *   class.item              →  .item
 *   id.list.0@tag.a         →  #list a
 *   //meta[@...]/@content   →  (skip XPath)
 *   @css:div > span         →  div > span
 *   text.下一页@href         →  keep as-is (handled by extractByText)
 *   @textNodes / ##regex    →  keep as-is (handled by resolveContentRule)
 */
function simplifyLegadoSelector(val) {
  if (!val || typeof val !== 'string') return ''
  if (val.startsWith('@js:') || val.startsWith('js:')) return ''
  if (val.includes('{{') && val.includes('}}')) return ''

  // XPath: skip
  if (val.startsWith('//') || val.startsWith('@xpath:')) return ''

  // @css: prefix → strip it
  if (val.startsWith('@css:')) val = val.slice(5)

  // text.xxx pattern → keep
  if (/^text\./.test(val)) return val

  // Keep @textNodes suffix and ##regex for later
  const suffix = (val.match(/@textNodes.*$/) || [])[0] || ''
  if (suffix) val = val.replace(/@textNodes.*$/, '')

  // Step 1: convert @tag.xxx@attr → xxx@attr (nested tag selector)
  val = val.replace(/@tag\.(\w+)(\.\d+)?/gi, ' $1')

  // Step 2: strip numeric indices from tag/class/id tokens
  // tag.h3.0 → h3, class.item.0 → .item, id.list.0 → #list
  val = val
    .replace(/\b(id|class|tag)\.(\w+)\.\d+\b/gi, (_, t, n) => t === 'id' ? '#' + n : t === 'class' ? '.' + n : n)
    .replace(/\btag\.(\w+)\[.*?\]/gi, '$1')
    .replace(/\btag\.(\w+)\.!-?\d+\b/gi, '$1')
    .replace(/\bclass\.(\w+)(?!\.)/gi, '.$1')
    .replace(/\bid\.(\w+)(?!\.)/gi, '#$1')
    .replace(/\btag\.(\w+)\b/gi, '$1')

  // Step 3: clean leftover legado noise
  val = val.replace(/,\{.*?\}/g, '').replace(/!0/g, '').replace(/@children\[\d+\]/g, '').replace(/\$\$\.data\..*$/, '')

  return (val + suffix).trim()
}

/** Wipe everything and reset to current builtins. */
export function resetToBuiltins() {
  libStore.set(STORE_KEY, builtinSources.map(s => withDefaults({ ...s, builtin: true })))
}

/** Bulk replace — used by import. Auto-detects legado format. */
export function replaceSources(sources) {
  if (!Array.isArray(sources)) return { success: false, error: '格式不正确，应为数组' }
  const cleaned = []
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue
    // Auto-detect legado format (has bookSourceUrl instead of baseUrl)
    const converted = s.bookSourceUrl ? convertLegadoSource(s) : s
    if (!converted.id || !converted.name || !converted.baseUrl) continue
    // Skip sources with JS-only rules — we can't execute them
    if (!converted.searchUrl && !converted.content) continue
    cleaned.push(withDefaults({ ...converted, builtin: false }))
  }
  // Preserve builtins
  const builtins = listSources().filter(s => s.builtin)
  libStore.set(STORE_KEY, [...builtins, ...cleaned])
  return { success: true, imported: cleaned.length }
}

/**
 * Update health stats for a source. Called from searcher.js after each request.
 * `outcome` is 'ok' | 'fail'; `meta` may carry { error, latencyMs }.
 */
export function updateHealth(id, outcome, meta = {}) {
  const all = listSources()
  const idx = all.findIndex(s => s.id === id)
  if (idx < 0) return
  const h = all[idx].health
  const successCount = h.successCount + (outcome === 'ok' ? 1 : 0)
  const failCount = h.failCount + (outcome === 'fail' ? 1 : 0)
  // Exponential moving average for latency
  const prevAvg = h.avgLatencyMs
  const avgLatencyMs = meta.latencyMs != null
    ? (prevAvg == null ? meta.latencyMs : Math.round(prevAvg * 0.7 + meta.latencyMs * 0.3))
    : prevAvg
  all[idx] = {
    ...all[idx],
    health: {
      status: outcome,
      lastTestedAt: Date.now(),
      lastError: outcome === 'fail' ? (meta.error || '未知错误') : null,
      successCount,
      failCount,
      avgLatencyMs
    }
  }
  libStore.set(STORE_KEY, all)
}

/** Reset health counters — useful after editing a source. */
export function resetHealth(id) {
  const all = listSources()
  const idx = all.findIndex(s => s.id === id)
  if (idx < 0) return
  all[idx] = {
    ...all[idx],
    health: {
      status: 'unknown',
      lastTestedAt: null,
      lastError: null,
      successCount: 0,
      failCount: 0,
      avgLatencyMs: null
    }
  }
  libStore.set(STORE_KEY, all)
}
