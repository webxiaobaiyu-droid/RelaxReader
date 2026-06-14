import { fetchHtml, extract, resolveContentRule } from './parser.js'
import { fetchChapterContent } from './universal.js'
import {
  listSources, listEnabledSources, getSource, updateHealth
} from '../sources/registry.js'

/** Thin wrapper kept for clarity — delegates everything to the unified fetchHtml. */
function fetchHtmlWithMethod(url, method, body) {
  if (method === 'POST' && body) return fetchHtml(url, { method: 'POST', body })
  return fetchHtml(url)
}

/**
 * Run one source's search, returning per-source results + timing info.
 * Errors are caught so callers can use Promise.allSettled.
 */
async function searchOneSource(source, keyword) {
  const start = Date.now()
  const makeUrl = (url) => {
    let u = url.replace('{keyword}', encodeURIComponent(keyword))
    // Resolve relative URLs against baseUrl
    if (u.startsWith('/')) {
      try { u = new URL(u, source.baseUrl).href } catch {}
    }
    return u
  }
  const body = source.searchBody?.replace('{keyword}', encodeURIComponent(keyword))

  // Try primary search URL first
  let html = await fetchHtmlWithMethod(makeUrl(source.searchUrl), source.searchMethod, body)

  // Fallback to alternate search URL if primary fails
  if (!html && source.searchFallback) {
    html = await fetchHtmlWithMethod(makeUrl(source.searchFallback), source.searchMethod, body)
  }

  if (!html) throw new Error('页面为空')

  const items = []
  const seen = new Set()

  // ── Method A: use source-defined search selectors if available ──
  if (source.searchList) {
    const rows = extractList(html, source.searchList)
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const name = source.searchName ? extractOneSel(row, source.searchName) : ''
        const href = extractOneSel(row, 'a@href')
        const author = source.searchAuthor ? extractOneSel(row, source.searchAuthor) : '未知'
        if (!name || !href) continue
        const bookUrl = href.startsWith('http') ? href : new URL(href, source.baseUrl).href
        if (seen.has(bookUrl)) continue
        seen.add(bookUrl)
        items.push({
          sourceId: source.id, sourceName: source.name,
          title: String(name).trim(), author: String(author).replace(/^作者[：:]\s*/, '').trim(),
          cover: null, bookUrl
        })
        if (items.length >= 20) break
      }
    }
  }

  // ── Method B: heuristic link scoring (fallback) ──
  if (items.length === 0) {
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]{2,80})<\/a>/gi
    let match
    while ((match = linkRegex.exec(html)) !== null) {
      let href = match[1]
      const text = match[2].trim()
      if (text.length < 2 || text.length > 80) continue
      if (/首页|登录|注册|排行|分类|搜索|下载|书架|书签|设置|退出|收藏|推荐|报错|留言|积分|原图片/.test(text)) continue
      if (href.startsWith('javascript:') || href.startsWith('#')) continue
      if (!href.startsWith('http')) href = new URL(href, source.baseUrl).href
      // Match book-like URL patterns:
      //   /book/123  /html/123/  /7/7877/  /22_33/
      // But NOT:  /class/1/  /sort/2/  /list/3/  /fenlei/1/
      if (href.match(/\/(class|sort|list|fenlei|type|page|modules)\//)) continue
      if (!href.match(/\/(book|html)\/\d+|\/\d+\/\d+|\/\d+_\d+/)) continue
      if (seen.has(href)) continue
      seen.add(href)
      items.push({
        sourceId: source.id, sourceName: source.name,
        title: text, author: '未知', cover: null, bookUrl: href
      })
      if (items.length >= 20) break
    }
  }

  return { items, latencyMs: Date.now() - start }
}

/**
 * Search across one or every enabled source concurrently.
 * - Per-source failures are isolated and reported via `meta.sources`
 * - Health stats (success/fail counts, latency) are updated as a side effect
 * - Results are de-duplicated across sources by (title, author)
 */
export async function searchBooks(keyword, sourceId) {
  const pool = sourceId
    ? listSources().filter(s => s.id === sourceId)
    : listEnabledSources()

  if (pool.length === 0) {
    return { success: false, error: '当前没有启用的书源，请先在书源管理中启用' }
  }

  const settled = await Promise.allSettled(pool.map(s => searchOneSource(s, keyword)))

  const allResults = []
  const sourceMeta = []
  const seenTitleAuthor = new Set()

  pool.forEach((source, i) => {
    const r = settled[i]
    if (r.status === 'fulfilled') {
      const { items, latencyMs } = r.value
      updateHealth(source.id, 'ok', { latencyMs })
      sourceMeta.push({ id: source.id, name: source.name, count: items.length, latencyMs, error: null })
      for (const item of items) {
        const key = `${item.title}::${item.author}`
        if (seenTitleAuthor.has(key)) continue
        seenTitleAuthor.add(key)
        allResults.push(item)
      }
    } else {
      const error = r.reason?.message || String(r.reason)
      updateHealth(source.id, 'fail', { error })
      sourceMeta.push({ id: source.id, name: source.name, count: 0, latencyMs: null, error })
    }
  })

  return { success: true, data: allResults, meta: { sources: sourceMeta } }
}

/**
 * Probe a single source by running a known-good search.
 * Used by the "测试" button in source manager — always updates health.
 */
export async function testSource(id, keyword) {
  const source = getSource(id)
  if (!source) return { success: false, error: '书源不存在' }
  try {
    const { items, latencyMs } = await searchOneSource(source, keyword)
    updateHealth(id, 'ok', { latencyMs })
    return { success: true, data: { count: items.length, latencyMs, sample: items.slice(0, 3) } }
  } catch (e) {
    const error = e.message || String(e)
    updateHealth(id, 'fail', { error })
    return { success: false, error }
  }
}

/**
 * Fetch full book details + chapter list from a source.
 */
export async function fetchBook(sourceId, bookUrl) {
  const source = getSource(sourceId)
  if (!source) return { success: false, error: `未知书源: ${sourceId}` }

  try {
    const html = await fetchHtml(bookUrl)
    if (!html) return { success: false, error: '无法获取书籍页面' }

    // Title: #info h1
    const titleMatch = html.match(/<div[^>]*id=['"]info['"][^>]*>[\s\S]*?<h1[^>]*>([^<]+)<\/h1>/i)
    const title = titleMatch?.[1]?.trim() || '未知书名'

    // Author: <p> with 作...者
    const authorMatch = html.match(/<p>[^<]*作[^<]*者[：:]\s*([^<]+)<\/p>/i)
    const author = authorMatch?.[1]?.trim() || '未知'

    // Cover: #fmimg img src
    const coverMatch = html.match(/<div[^>]*id=['"]fmimg['"][^>]*>[\s\S]*?<img[^>]*src=['"]([^'"]+)['"]/i)
      || html.match(/<img[^>]*(?:id|class)=['"][^'"]*(?:cover|fmimg|bookimg)[^'"]*['"][^>]*src=['"]([^'"]+)['"]/i)
      || html.match(/<img[^>]*src=['"]([^'"]+)['"][^>]*(?:alt|title)=['"][^'"]*(?:封面|书籍|小说)[^'"]*['"]/i)
    const cover = normalizeUrl(coverMatch?.[1] || null, bookUrl)

    // Description: #intro p text
    const introMatch = html.match(/<div[^>]*id=['"]intro['"][^>]*>([\s\S]*?)<\/div>/i)
    const desc = introMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || ''

    // Chapters: #list dd a — use depth tracking for nested divs
    let listHtml = html
    const listStartMarker = html.indexOf('id="list"') !== -1
      ? html.indexOf('id="list"')
      : html.indexOf("id='list'")
    if (listStartMarker !== -1) {
      const listTagClose = html.indexOf('>', listStartMarker) + 1
      let d = 1, p = listTagClose
      while (d > 0 && p < html.length) {
        if (html.substring(p, p + 5) === '<div ' || html.substring(p, p + 4) === '<div>') { d++; p = html.indexOf('>', p) + 1 }
        else if (html.substring(p, p + 6) === '</div>') { d--; if (d === 0) break; p += 6 }
        else p++
      }
      if (d === 0) listHtml = html.substring(listTagClose, p)
    }
    const chapterRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/gi
    let m
    const chapters = []
    const base = new URL(bookUrl)

    while ((m = chapterRegex.exec(listHtml)) !== null) {
      let href = m[1]
      const text = m[2].trim()

      // Skip non-chapter links
      if (text.length < 2 || text.length > 80) continue
      if (/首页|登录|注册|排行|分类|搜索|下载|书架|书签|设置|退出|收藏|推荐|报错|留言|积分|原图片/.test(text)) continue

      // Resolve relative URLs
      if (!href.startsWith('http')) href = new URL(href, base.origin).href

      chapters.push({ index: chapters.length, title: text, url: href })
    }

    return {
      success: true,
      data: { title, author, cover, description: desc, sourceId, bookUrl, chapters }
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

function normalizeUrl(url, baseUrl) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed || trimmed.startsWith('data:')) return trimmed || null
  try {
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    if (trimmed.startsWith('//')) return `${new URL(baseUrl).protocol}${trimmed}`
    return new URL(trimmed, baseUrl).href
  } catch {
    return trimmed
  }
}

/**
 * Decode base64-encoded content from JS calls like:
 *   document.writeln(qsbs.bb('PHA+base64...'));
 * Some sites obfuscate chapter text this way to deter simple scraping.
 * We extract every base64 payload, decode, concatenate, then strip HTML.
 */
function decodeBase64Content(raw) {
  // Match patterns: qsbs.bb('...') or atob('...') or Base64.decode('...')
  const b64Regex = /(?:qsbs\.bb|atob|Base64\.decode)\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/g
  const parts = []
  let m
  while ((m = b64Regex.exec(raw)) !== null) {
    try {
      parts.push(Buffer.from(m[1], 'base64').toString('utf-8'))
    } catch { /* skip invalid base64 */ }
  }
  if (parts.length === 0) return ''
  return parts.join('')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Strip HTML from raw content block → plain text.
 */
function htmlToText(raw) {
  return raw
    .replace(/<div[^>]*id=['"]content_tip['"][^>]*>[\s\S]*?<\/div>/i, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Extract the raw inner HTML of the #content div, handling nested divs.
 */
function extractContentDiv(html) {
  const startMarker = 'id="content"'
  const startMarkerSingle = "id='content'"
  let startIdx = html.indexOf(startMarker)
  if (startIdx === -1) startIdx = html.indexOf(startMarkerSingle)
  if (startIdx === -1) return ''

  const tagClose = html.indexOf('>', startIdx) + 1
  let depth = 1
  let pos = tagClose
  while (depth > 0 && pos < html.length) {
    if (html.substring(pos, pos + 5) === '<div ' || html.substring(pos, pos + 4) === '<div>') {
      depth++
      pos = html.indexOf('>', pos) + 1
    } else if (html.substring(pos, pos + 6) === '</div>') {
      depth--
      if (depth === 0) break
      pos += 6
    } else {
      pos++
    }
  }
  return depth === 0 ? html.substring(tagClose, pos) : ''
}

/**
 * Fetch chapter content.
 */
export async function fetchChapter(sourceId, chapterUrl) {
  const source = getSource(sourceId)
  if (!source) return { success: false, error: `未知书源: ${sourceId}` }

  try {
    const html = await fetchHtml(chapterUrl)
    if (!html) return { success: false, error: '无法获取章节内容' }

    // ── Try source's own content rule first (legado-compatible) ──
    if (source.content) {
      const resolved = resolveContentRule(html, source.content)
      if (resolved && resolved.length >= 50) {
        // Check if content is base64-encoded JS (e.g. dingdiann.org)
        if (resolved.includes('document.write') || resolved.includes('qsbs.bb') || resolved.includes('atob(')) {
          const decoded = decodeBase64Content(resolved)
          if (decoded && decoded.length >= 50) {
            return { success: true, data: decoded }
          }
        } else {
          return { success: true, data: resolved }
        }
      }
    }

    let content = ''

    // Find #content div with depth tracking (handles nested divs)
    const rawContent = extractContentDiv(html)
    if (rawContent) {
      // Check for base64-encoded content first
      if (rawContent.includes('document.write') || rawContent.includes('qsbs.bb') || rawContent.includes('atob(')) {
        content = decodeBase64Content(rawContent)
      }
      // Otherwise strip HTML normally
      if (!content || content.length < 50) {
        content = htmlToText(rawContent)
      }
    }

    // Fallback: try other common content containers
    if (!content || content.length < 50) {
      const patterns = [
        /<div[^>]*class=['"][^'']*content[^'']*['"][^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*id=['"]chaptercontent['"][^>]*>([\s\S]*?)<\/div>/i,
        /<article[^>]*>([\s\S]*?)<\/article>/i,
      ]
      for (const p of patterns) {
        const m = html.match(p)
        if (m && m[1].length > 200) {
          // Check for base64 in fallback containers too
          if (m[1].includes('document.write') || m[1].includes('qsbs.bb')) {
            content = decodeBase64Content(m[1])
          }
          if (!content || content.length < 50) {
            content = htmlToText(m[1])
          }
          if (content && content.length >= 50) break
        }
      }
    }

    if (!content || content.length < 50) {
      // Last resort: try universal content fetcher (works on most sites)
      const universalResult = await fetchChapterContent(chapterUrl)
      if (universalResult.success) return universalResult
      return { success: false, error: '未能提取章节内容' }
    }

    return { success: true, data: content }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── Helpers ──

/** Extract a list of elements from HTML using a CSS-like selector */
function extractList(html, selector) {
  if (!selector) return null
  // Handle "parent child" selectors: table.grid tr, #author tr, .newscontent li
  if (selector.includes(' ')) {
    const spaceIdx = selector.lastIndexOf(' ')
    const parentSel = selector.substring(0, spaceIdx).trim()
    const childSel = selector.substring(spaceIdx + 1).trim()
    // Find parent element(s)
    const parentResult = extract(html, parentSel)
    const parentHtml = typeof parentResult === 'string' ? parentResult
      : Array.isArray(parentResult) ? parentResult.join('') : null
    if (!parentHtml) {
      // Fallback: try extracting child directly from full HTML
      return extractAll(html, childSel)
    }
    return extractAll(parentHtml, childSel)
  }
  return extractAll(html, selector)
}

/** Extract one value from HTML using simple selector */
function extractOneSel(html, selector) {
  if (!selector) return null
  if (selector === 'text') return html.replace(/<[^>]+>/g, '').trim()
  if (selector === 'href') {
    const m = html.match(/href=["']([^"']+)["']/i)
    return m ? m[1] : null
  }
  if (selector === 'src') {
    const m = html.match(/src=["']([^"']+)["']/i)
    return m ? m[1] : null
  }
  return extract(html, selector)
}

function extractAll(html, selector) {
  if (!selector) return null
  // Split by parent > child
  if (selector.includes(' > ')) {
    return extractNested(html, selector)
  }
  const pattern = buildListPattern(selector)
  const regex = new RegExp(pattern, 'gi')
  const items = []
  let m
  while ((m = regex.exec(html)) !== null) {
    items.push(m[0])
  }
  return items.length ? items : null
}

function extractNested(html, selector) {
  const [parent, child] = selector.split(/\s*>\s*/)
  const parents = extractAll(html, parent)
  if (!parents) return null
  const results = []
  for (const p of parents) {
    const items = extractAll(p, child)
    if (items) results.push(...items)
  }
  return results.length ? results : null
}

function extractOne(html, selector) {
  if (!selector) return null
  return extract(html, selector)
}

function buildListPattern(selector) {
  const parts = selector.split(/([.#])/).filter(Boolean)
  const tag = parts[0].match(/^[a-zA-Z0-9]+/) ? parts[0] : 'li'
  const id = selector.match(/#([a-zA-Z0-9_-]+)/)?.[1]
  const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1])

  let pattern = `<${tag}\\b[^>]*`
  if (id) pattern += `\\s+id\\s*=\\s*["']${id}["']`
  for (const cls of classes) {
    pattern += `(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${cls}\\b)`
  }
  pattern += '[^>]*>'
  // Match until closing tag
  pattern += `([\\s\\S]*?)<\\/${tag}\\s*>`
  return pattern
}
