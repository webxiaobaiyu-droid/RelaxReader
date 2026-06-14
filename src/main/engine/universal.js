import { fetchHtml } from './parser.js'

/**
 * Universal book page parser using heuristics.
 * Works with most Chinese novel sites without site-specific config.
 */
export async function parseBookPage(url) {
  let html
  try {
    html = await fetchHtml(url)
  } catch (e) {
    return { success: false, error: `无法访问该页面：${e.message}` }
  }
  if (!html) return { success: false, error: '页面返回为空' }

  const base = new URL(url)

  // ── Title ──
  // Prefer h1 (usually the cleanest), fall back to <title> with suffix stripping
  let title = ''
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1Match) {
    title = h1Match[1].replace(/<[^>]+>/g, '').trim()
  }
  if (!title || title.length > 40) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
    if (titleMatch) {
      title = titleMatch[1]
        .replace(/[_|·—\-–]\s*[^_|·—\-–]*$/, '')  // strip last suffix segment
        .replace(/(全文阅读|最新章节|无弹窗|笔趣阁|小说网|在线阅读|TXT下载).*$/g, '')
        .trim()
    }
  }
  if (!title) title = '未知书名'

  // ── Author ──
  let author = '未知'
  const authorPatterns = [
    /作者[：:]\s*([^<\n]{2,20})/,
    /author"[^>]*content="([^"]+)"/i,
  ]
  for (const p of authorPatterns) {
    const m = html.match(p)
    if (m && m[1].trim().length <= 20) { author = m[1].trim(); break }
  }

  // ── Cover ──
  let cover = null
  const coverMatch = html.match(/<img[^>]*?(?:cover|封面|fmimg|bookimg)[^>]*?src=["']([^"']+)["']/i)
    || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:alt|title)=["'][^"']*(?:封面|书籍|小说)[^"']*["']/i)
    || html.match(/<div[^>]*(?:id|class)=["'][^"']*(?:cover|fmimg|bookimg)[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
  if (coverMatch) {
    cover = normalizeUrl(coverMatch[1], base.href)
  }

  // ── Chapters ──
  // Find all <a> tags, score them by likelihood of being chapter links
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["']([^>]*)>([^<]{2,80})<\/a>/gi
  let match
  const candidates = []

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1]
    const attrs = match[2]
    const text = match[3].trim()

    // Skip non-chapter links
    if (href.startsWith('javascript:') || href.startsWith('#') || href.includes('login')) continue
    if (/首页|下载|简介|评论|排行|分类|搜索|登录|注册|手机版|客户端|app|关于|联系|首页|下一章|上一章/.test(text)) continue
    if (text.length < 2 || text.length > 80) continue

    // Resolve URL
    if (!href.startsWith('http')) href = new URL(href, base).href

    // Score: higher = more likely a chapter link
    let score = 0
    if (/第[零一二三四五六七八九十百千万\d]+[章节回]/.test(text)) score += 30
    if (/^\d+[\.、\s]/.test(text)) score += 15
    if (/chapter/i.test(href) || /\/\d+\.html?/.test(href)) score += 10
    if (text.length >= 3 && text.length <= 30) score += 5
    if (new URL(href).pathname.length > 3) score += 3
    // Penalize if text looks like navigation
    if (/^[上下前後]/.test(text)) score -= 20

    candidates.push({ href, title: text, score, pos: match.index })
  }

  // Dedupe candidates by URL — many sites repeat the same link in nav + list
  const seenUrl = new Set()
  const unique = []
  for (const c of candidates) {
    if (seenUrl.has(c.href)) continue
    seenUrl.add(c.href)
    unique.push(c)
  }

  // Take top-scoring links as chapters
  unique.sort((a, b) => b.score - a.score)
  const threshold = unique.length > 10 ? unique[Math.floor(unique.length * 0.3)]?.score || 0 : 0
  const filtered = unique.filter(c => c.score >= Math.max(threshold, 3))

  // If high-confidence filter killed everything, fall back to all candidates
  const picked = filtered.length >= 5 ? filtered : unique

  // Re-sort by DOM order so reading order is preserved
  picked.sort((a, b) => a.pos - b.pos)

  const chapters = picked.slice(0, 5000).map((c, i) => ({
    index: i, title: c.title, url: c.href, content: ''
  }))

  if (chapters.length === 0) {
    return { success: false, error: '页面上未识别到章节链接，请确认这是小说目录页（不是首页/详情页）' }
  }

  return {
    success: true,
    data: {
      title, author, cover,
      sourceId: 'universal',
      bookUrl: url,
      chapters,
      description: ''
    }
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
 * Fetch chapter content with generic content extraction.
 */
export async function fetchChapterContent(chapterUrl) {
  let html
  try {
    html = await fetchHtml(chapterUrl)
  } catch (e) {
    return { success: false, error: `无法获取章节：${e.message}` }
  }
  if (!html) return { success: false, error: '章节页面为空' }

  // Try common content containers
  const contentPatterns = [
    /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["']chaptercontent["'][^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class=["'][^"']*chapter[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*article[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ]

  let content = ''
  for (const p of contentPatterns) {
    const m = html.match(p)
    if (m && m[1].length > 200) {
      // Handle base64-encoded content (e.g. qsbs.bb('...') calls)
      if (m[1].includes('qsbs.bb') || m[1].includes('atob(')) {
        const b64Regex = /(?:qsbs\.bb|atob)\s*\(\s*['"]([A-Za-z0-9+/=]+)['"]\s*\)/g
        const parts = []
        let b64m
        while ((b64m = b64Regex.exec(m[1])) !== null) {
          try { parts.push(Buffer.from(b64m[1], 'base64').toString('utf-8')) } catch {}
        }
        if (parts.length > 0) {
          content = parts.join('')
          break
        }
      }
      content = m[1]
      break
    }
  }

  // Fallback: extract the largest text block
  if (!content) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) {
      // Strip scripts, styles, and HTML tags
      content = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
  } else {
    // Clean HTML content
    content = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  if (!content || content.length < 50) {
    return { success: false, error: '未能提取章节内容' }
  }

  return { success: true, data: content }
}
