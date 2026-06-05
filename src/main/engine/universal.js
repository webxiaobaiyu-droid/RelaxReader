import { fetchHtml } from './parser.js'

/**
 * Universal book page parser using heuristics.
 * Works with most Chinese novel sites without site-specific config.
 */
export async function parseBookPage(url) {
  const html = await fetchHtml(url)
  if (!html) return { success: false, error: '无法访问该页面' }

  const base = new URL(url)

  // ── Title ──
  let title = ''
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/[_|—\-–].*$/, '')    // remove site suffix
      .replace(/全文阅读|最新章节|无弹窗|笔趣阁|小说网.*$/g, '')
      .trim()
  }
  // Fallback: find h1
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) title = h1Match[1].trim()
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
  const coverMatch = html.match(/<img[^>]*?(?:cover|封面|fmimg)[^>]*?src=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i)
  if (coverMatch) {
    cover = coverMatch[1]
    if (!cover.startsWith('http')) cover = new URL(cover, base).href
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

    candidates.push({ href, title: text, score })
  }

  // Take top-scoring links as chapters
  candidates.sort((a, b) => b.score - a.score)
  const threshold = candidates.length > 10 ? candidates[Math.floor(candidates.length * 0.3)]?.score || 0 : 0
  const chapters = candidates
    .filter(c => c.score >= Math.max(threshold, 3))
    .map((c, i) => ({ index: i, title: c.title, url: c.href, content: '' }))

  // If we got too few chapters, lower threshold
  const finalChapters = chapters.length >= 5
    ? chapters.slice(0, 5000)
    : candidates.slice(0, 5000).map((c, i) => ({ index: i, title: c.title, url: c.href, content: '' }))

  return {
    success: true,
    data: {
      title, author, cover,
      sourceId: 'universal',
      bookUrl: url,
      chapters: finalChapters,
      description: ''
    }
  }
}

/**
 * Fetch chapter content with generic content extraction.
 */
export async function fetchChapterContent(chapterUrl) {
  const html = await fetchHtml(chapterUrl)
  if (!html) return { success: false, error: '无法获取章节' }

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
    if (m && m[1].length > 200) { content = m[1]; break }
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
