import { fetchHtml, extract } from './parser.js'
import { builtinSources } from '../sources/builtin.js'

/**
 * Fetch HTML with optional POST method support.
 */
async function fetchHtmlWithMethod(url, method, body) {
  if (method === 'POST' && body) {
    const mod = url.startsWith('https') ? await import('https') : await import('http')
    const zlib = await import('zlib')
    const postData = body
    const urlObj = new URL(url)
    return new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }
      const req = mod.request(options, (res) => {
        let stream = res
        const encoding = res.headers['content-encoding']
        if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip())
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate())
        let bodyData = ''
        stream.setEncoding('utf-8')
        stream.on('data', c => bodyData += c)
        stream.on('end', () => resolve(bodyData))
        stream.on('error', reject)
      })
      req.on('error', reject)
      req.write(postData)
      req.end()
    })
  }
  return fetchHtml(url)
}

/**
 * Search books across configured sources.
 */
export async function searchBooks(keyword, sourceId) {
  const sources = sourceId
    ? builtinSources.filter(s => s.id === sourceId)
    : builtinSources

  const allResults = []

  for (const source of sources) {
    try {
      const searchUrl = source.searchUrl.replace('{keyword}', encodeURIComponent(keyword))
      const searchBody = source.searchBody?.replace('{keyword}', encodeURIComponent(keyword))
      const html = await fetchHtmlWithMethod(searchUrl, source.searchMethod, searchBody)

      if (!html) continue

      // For POST search results (like xbiqugu), parse the full page for book links
      const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]{2,80})<\/a>/gi
      let match
      const seen = new Set()

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1]
        const text = match[2].trim()

        // Skip navigation/non-book links
        if (text.length < 2 || text.length > 80) continue
        if (/首页|登录|注册|排行|分类|搜索|下载|书架|书签|设置|退出|收藏|推荐|报错|留言|积分|原图片/.test(text)) continue
        if (href.startsWith('javascript:') || href.startsWith('#')) continue

        // Resolve relative URLs
        if (!href.startsWith('http')) href = new URL(href, source.baseUrl).href

        // Only include links that look like book pages (e.g., /7/7877/)
        const pathMatch = href.match(/\/\d+\/\d+\/?$/)
        if (!pathMatch) continue

        // Deduplicate
        if (seen.has(href)) continue
        seen.add(href)

        allResults.push({
          sourceId: source.id,
          sourceName: source.name,
          title: text,
          author: '未知',
          cover: null,
          bookUrl: href
        })

        if (allResults.length >= 20) break
      }
    } catch (e) {
      console.error(`Source ${source.id} search error:`, e.message)
    }
  }

  return { success: true, data: allResults }
}

/**
 * Fetch full book details + chapter list from a source.
 */
export async function fetchBook(sourceId, bookUrl) {
  const source = builtinSources.find(s => s.id === sourceId)
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
    const coverMatch = html.match(/<div[^>]*id=['"]fmimg['"][^>]*>\s*<img[^>]*src=['"]([^'"]+)['"]/i)
    const cover = coverMatch?.[1] || null

    // Description: #intro p text
    const introMatch = html.match(/<div[^>]*id=['"]intro['"][^>]*>([\s\S]*?)<\/div>/i)
    const desc = introMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || ''

    // Chapters: #list dd a
    const listMatch = html.match(/<div[^>]*id=['"]list['"][^>]*>([\s\S]*?)<\/div>/i)
    const listHtml = listMatch?.[1] || html
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

/**
 * Fetch chapter content.
 */
export async function fetchChapter(sourceId, chapterUrl) {
  const source = builtinSources.find(s => s.id === sourceId)
  if (!source) return { success: false, error: `未知书源: ${sourceId}` }

  try {
    const html = await fetchHtml(chapterUrl)
    if (!html) return { success: false, error: '无法获取章节内容' }

    let content = ''

    // Find #content div with depth tracking (handles nested divs)
    const startMarker = 'id="content"'
    const startMarkerSingle = "id='content'"
    let startIdx = html.indexOf(startMarker)
    if (startIdx === -1) startIdx = html.indexOf(startMarkerSingle)
    if (startIdx !== -1) {
      const tagClose = html.indexOf('>', startIdx) + 1
      let depth = 1
      let pos = tagClose
      while (depth > 0 && pos < html.length) {
        if (html.substring(pos, pos + 5) === '<div ') {
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
      if (depth === 0) {
        content = html.substring(tagClose, pos)
          // Remove tip div
          .replace(/<div[^>]*id=['"]content_tip['"][^>]*>[\s\S]*?<\/div>/i, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .trim()
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
          content = m[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim()
          break
        }
      }
    }

    if (!content || content.length < 50) {
      return { success: false, error: '未能提取章节内容' }
    }

    return { success: true, data: content }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ── Helpers ──

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
