/**
 * Minimal CSS-selector-like HTML extraction.
 * Supports: tag selector, .class, @text, @html, @href, @src, @content
 * This avoids the cheerio dependency while being fast enough for book sources.
 */

/**
 * Fetch a URL and return its HTML body as string.
 * Uses Node's built-in http/https — no CORS in Electron main process.
 * Handles gzip/deflate content encoding.
 */
export async function fetchHtml(url) {
  const mod = url.startsWith('https') ? await import('https') : await import('http')
  const zlib = await import('zlib')
  return new Promise((resolve, reject) => {
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    }, (res) => {
      // Follow redirects (max 3)
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) return fetchHtml(loc.startsWith('http') ? loc : new URL(loc, url).href).then(resolve, reject)
      }
      let stream = res
      const encoding = res.headers['content-encoding']
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate())
      let body = ''
      stream.setEncoding('utf-8')
      stream.on('data', c => body += c)
      stream.on('end', () => resolve(body))
      stream.on('error', reject)
    }).on('error', reject)
  })
}

/**
 * Extract data from HTML using a simple selector syntax:
 *   "tag.class@attr" → find elements, extract attr
 *   "@text" → textContent
 *   "@html" → innerHTML
 *   "@href" → href attribute
 *   "@src" → src attribute
 *   "tag" → just find elements
 */
export function extract(html, selector) {
  if (!html || !selector) return null

  // Handle @text, @html, @href, @src separately
  const attrMatch = selector.match(/^(.+?)@(text|html|href|src|content)$/)
  const baseSelector = attrMatch ? attrMatch[1].trim() : selector
  const extractAttr = attrMatch ? attrMatch[2] : null

  // Parse: tag#id.class1.class2
  const parts = baseSelector.split(/([.#])/).filter(Boolean)
  const tag = parts[0].match(/^[a-zA-Z]+/) ? parts[0] : null
  const id = baseSelector.match(/#([a-zA-Z0-9_-]+)/)?.[1]
  const classes = [...baseSelector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1])

  // If no tag specified and has class/id, use wildcard
  const tagPattern = tag || (classes.length || id ? '[a-zA-Z0-9]+' : null)
  if (!tagPattern) return null

  // Build regex
  const pattern = buildElementPattern(tagPattern, id, classes)
  const regex = new RegExp(pattern, 'gi')

  let match
  const results = []
  while ((match = regex.exec(html)) !== null) {
    const element = match[0]
    if (extractAttr) {
      results.push(extractElementAttr(element, extractAttr))
    } else {
      results.push(element)
    }
  }

  // Handle parent > child selector
  if (baseSelector.includes(' > ')) {
    return queryNested(html, baseSelector, extractAttr)
  }

  return results.length === 0 ? null : results.length === 1 ? results[0] : results
}

function buildElementPattern(tag, id, classes) {
  let pattern = `<${tag}\\b[^>]*`
  if (id) pattern += `\\s+id\\s*=\\s*["']${escapeRegex(id)}["']`
  for (const cls of classes) {
    pattern += `(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${escapeRegex(cls)}\\b)`
  }
  pattern += '[^>]*>'
  return pattern
}

function extractElementAttr(element, attr) {
  switch (attr) {
    case 'text':
      return element.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
    case 'html':
      return element.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>$/, '').trim()
    case 'href': {
      const m = element.match(/href\s*=\s*["']([^"']+)["']/i)
      return m ? m[1] : null
    }
    case 'src': {
      const m = element.match(/src\s*=\s*["']([^"']+)["']/i)
      return m ? m[1] : null
    }
    case 'content':
      return element.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
    default:
      return element
  }
}

function queryNested(html, selector, extractAttr) {
  // Simple parent > child: find parent blocks first
  const [parentSel, childSel] = selector.split(/\s*>\s*/).map(s => s.trim())
  const parentBlocks = []
  const parentRegex = buildRegexFromSelector(parentSel)
  let m
  while ((m = parentRegex.exec(html)) !== null) {
    // Find closing tag
    const tagName = parentSel.match(/^([a-zA-Z]+)/)?.[1] || 'div'
    const start = m.index
    const depth = countDepth(html, start, tagName)
    parentBlocks.push(html.slice(start, depth))
  }

  const results = []
  for (const block of parentBlocks) {
    const childResult = extract(block, childSel + (extractAttr ? `@${extractAttr}` : ''))
    if (childResult) {
      if (Array.isArray(childResult)) results.push(...childResult)
      else results.push(childResult)
    }
  }
  return results.length === 0 ? null : results
}

function buildRegexFromSelector(sel) {
  const tag = sel.match(/^([a-zA-Z]+)/)?.[1] || '[a-zA-Z0-9]+'
  const id = sel.match(/#([a-zA-Z0-9_-]+)/)?.[1]
  const classes = [...sel.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1])
  return new RegExp(buildElementPattern(tag, id, classes), 'gi')
}

function countDepth(html, start, tagName) {
  let depth = 0
  const openRegex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  const closeRegex = new RegExp(`</${tagName}\\s*>`, 'gi')
  let pos = start

  openRegex.lastIndex = pos
  closeRegex.lastIndex = pos

  while (pos < html.length) {
    openRegex.lastIndex = pos
    closeRegex.lastIndex = pos
    const openMatch = openRegex.exec(html)
    const closeMatch = closeRegex.exec(html)

    if (!closeMatch) return html.length

    if (openMatch && openMatch.index < closeMatch.index) {
      depth++
      pos = openMatch.index + openMatch[0].length
    } else {
      depth--
      if (depth <= 0) return closeMatch.index + closeMatch[0].length
      pos = closeMatch.index + closeMatch[0].length
    }
  }
  return html.length
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
