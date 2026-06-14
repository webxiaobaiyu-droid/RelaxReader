/**
 * Minimal CSS-selector-like HTML extraction.
 * Supports: tag selector, .class, @text, @html, @href, @src, @content
 * This avoids the cheerio dependency while being fast enough for book sources.
 */

/**
 * Fetch a URL and return its HTML body as string.
 *
 * Improvements over a naive `setEncoding('utf-8')` approach:
 *   - Reads response as Buffer, then detects charset from
 *     Content-Type header → <meta charset> → fallback utf-8.
 *     Critical for Chinese novel sites which are mostly GBK.
 *   - 15s timeout (configurable) — no more infinite spinners.
 *   - gzip / deflate / br (Brotli) decompression.
 *   - GET (default) or POST with form body via options.method/body.
 *   - Up to 5 redirects, draining intermediate responses.
 */
export async function fetchHtml(url, options = {}) {
  const {
    method = 'GET',
    body = null,
    timeout = 15000,
    redirects = 5,
    headers: extraHeaders = {}
  } = options

  const mod = url.startsWith('https') ? await import('https') : await import('http')
  const zlib = await import('zlib')
  const u = new URL(url)

  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    ...extraHeaders
  }
  if (method === 'POST' && body) {
    reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/x-www-form-urlencoded'
    reqHeaders['Content-Length'] = Buffer.byteLength(body)
  }

  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || undefined,
      path: u.pathname + u.search,
      method,
      headers: reqHeaders,
      timeout
    }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        res.resume() // drain socket
        if (loc && redirects > 0) {
          const next = loc.startsWith('http') ? loc : new URL(loc, url).href
          return fetchHtml(next, { ...options, redirects: redirects - 1 }).then(resolve, reject)
        }
        return reject(new Error(loc ? '重定向次数超限' : `HTTP ${res.statusCode} 缺少 location`))
      }
      if (res.statusCode >= 400) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }

      let stream = res
      const ce = res.headers['content-encoding']
      if (ce === 'gzip') stream = res.pipe(zlib.createGunzip())
      else if (ce === 'deflate') stream = res.pipe(zlib.createInflate())
      else if (ce === 'br') stream = res.pipe(zlib.createBrotliDecompress())

      const chunks = []
      stream.on('data', c => chunks.push(c))
      stream.on('end', () => {
        const buf = Buffer.concat(chunks)
        if (buf.length === 0) return reject(new Error('响应为空'))
        const charset = detectCharset(res.headers['content-type'], buf)
        try {
          resolve(new TextDecoder(charset, { fatal: false }).decode(buf))
        } catch {
          // Unknown charset — fall back to utf-8
          resolve(buf.toString('utf-8'))
        }
      })
      stream.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('请求超时')))
    if (method === 'POST' && body) req.write(body)
    req.end()
  })
}

/**
 * Detect charset of a page. Priority:
 *   1. Content-Type header `charset=...`
 *   2. <meta charset="..."> or <meta http-equiv> in first 4KB
 *   3. Default utf-8
 */
function detectCharset(contentType, buffer) {
  const fromHeader = contentType?.match(/charset\s*=\s*["']?([^"';\s]+)/i)?.[1]
  if (fromHeader) return normalizeCharset(fromHeader)

  // Scan the first 4KB as ASCII — meta tags are ASCII-safe
  const head = buffer.slice(0, 4096).toString('latin1')
  const m1 = head.match(/<meta[^>]+charset\s*=\s*["']?([^"'>\s/]+)/i)
  const m2 = head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^"';\s]+)/i)
  const guess = m1?.[1] || m2?.[1]
  if (guess) return normalizeCharset(guess)

  return 'utf-8'
}

function normalizeCharset(cs) {
  const c = cs.toLowerCase().trim()
  if (c === 'gb2312' || c === 'gbk' || c === 'gb18030') return 'gbk'
  if (c === 'big5' || c === 'big5-hkscs') return 'big5'
  if (c === 'shift_jis' || c === 'shift-jis') return 'shift_jis'
  if (c === 'euc-jp') return 'euc-jp'
  if (c.startsWith('utf')) return 'utf-8'
  return c
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

// ═══════════════════════════════════════════
// Legado-compatible rule extensions
// ═══════════════════════════════════════════

/**
 * Find element by its visible text, then extract an attribute.
 * e.g. "text.下一页@href" → find <a> containing "下一页", return href
 *      "text.加入书架@text" → find element with text "加入书架"
 */
export function extractByText(html, rule) {
  const match = rule.match(/^text\.(.+?)@(\w+)$/)
  if (!match) return null
  const searchText = match[1].trim()
  const attr = match[2]

  // Find all elements containing this text
  const regex = new RegExp(
    `<([a-zA-Z0-9]+)[^>]*>([^<]*${escapeRegex(searchText)}[^<]*)<\\/\\1>`,
    'gi'
  )
  let m = regex.exec(html)
  if (!m) return null

  const element = m[0]
  if (attr === 'text') return m[2].trim()
  if (attr === 'href') {
    const hm = element.match(/href=["']([^"']+)["']/i)
    return hm ? hm[1] : null
  }
  if (attr === 'src') {
    const sm = element.match(/src=["']([^"']+)["']/i)
    return sm ? sm[1] : null
  }
  return element
}

/**
 * Extract text nodes from HTML — strips all tags, returns plain text.
 * This is the legado @textNodes equivalent.
 */
export function extractTextNodes(html) {
  if (!html) return ''
  return html
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
 * Apply legado-style regex replacements: ##pattern##replacement##pattern2##replacement2...
 * Multiple ##-separated pairs. $$n is a back-reference placeholder.
 */
export function applyLegadoRegex(text, ruleStr) {
  if (!text || !ruleStr) return text
  // Split on ## but not on the first one if it's empty
  const parts = ruleStr.split('##')
  let result = text
  // Parts: ["", pattern1, repl1, pattern2, repl2, ...] if starts with ##
  // Or: [pattern1, repl1, pattern2, repl2, ...] if no leading ##
  const startIdx = ruleStr.startsWith('##') ? 1 : 0
  for (let i = startIdx; i + 1 < parts.length; i += 2) {
    try {
      const pattern = parts[i]
      const replacement = parts[i + 1].replace(/\$\$(\d)/g, '$$$1') // $$1 → $1
      if (pattern) {
        result = result.replace(new RegExp(pattern, 'g'), replacement)
      }
    } catch { /* skip invalid regex */ }
  }
  return result
}

/**
 * Resolve a legado content rule. Handles:
 *   "#id@textNodes" → text nodes of #id
 *   "#id@textNodes##regex" → text nodes + regex cleanup
 *   "tag.class@text" → standard extract
 *   "@js:..." → skip (JS rules not supported)
 */
export function resolveContentRule(html, rule) {
  if (!rule || !html) return ''
  if (rule.startsWith('@js:') || rule.includes('{{')) return '' // JS rules: skip

  // Split regex part from selector part
  const regexIdx = rule.indexOf('##')
  const selectorPart = regexIdx >= 0 ? rule.substring(0, regexIdx) : rule
  const regexPart = regexIdx >= 0 ? rule.substring(regexIdx) : ''

  let content = ''

  if (selectorPart.endsWith('@textNodes')) {
    // Extract the element, then get text nodes
    const sel = selectorPart.replace(/@textNodes$/, '')
    const element = extract(html, sel)
    content = extractTextNodes(typeof element === 'string' ? element : (Array.isArray(element) ? element[0] : ''))
  } else if (selectorPart.includes('text.')) {
    content = extractByText(html, selectorPart) || ''
  } else if (selectorPart) {
    const raw = extract(html, selectorPart)
    content = typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw.join('\n') : '')
  }

  // Apply regex if present
  if (regexPart && content) {
    content = applyLegadoRegex(content, regexPart)
  }

  return content
}
