import fs from 'fs'
import path from 'path'

/**
 * Parse a TXT novel file with automatic encoding detection.
 * Supports UTF-8, UTF-16 (LE/BE), and GBK/GB2312.
 *
 * @param {string} filePath - Absolute path to the .txt file
 * @returns {{ title: string, author: string, chapters: Array<{ index: number, title: string, content: string }> }}
 */
export function parseTxt(filePath) {
  const filename = path.basename(filePath, path.extname(filePath))
  const buffer = fs.readFileSync(filePath)
  const text = detectAndDecode(buffer)

  // Try to extract title & author from first few lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  let title = filename
  let author = '未知作者'

  const titleMatch = lines.slice(0, 20).join('\n').match(/《(.+?)》|书名[：:]\s*(.+)/)
  if (titleMatch) {
    title = (titleMatch[1] || titleMatch[2]).trim()
  }

  const authorMatch = lines.slice(0, 20).join('\n').match(/作者[：:]\s*(.+)/)
  if (authorMatch) {
    author = authorMatch[1].trim()
  }

  // Chapter detection patterns (ordered by specificity)
  const chapterPatterns = [
    // 第X章 / 第XX章 / 第XXX章 with optional title
    /^第[零一二三四五六七八九十百千万0-9０-９]+\s*章[.\s]*(.*)$/m,
    /^第\d+\s*章[.\s]*(.*)$/m,
    // 第X节 / 第X回
    /^第[零一二三四五六七八九十百千万0-9０-９]+\s*[节回][.\s]*(.*)$/m,
    /^第\d+\s*[节回][.\s]*(.*)$/m,
    // Chapter N / CH.N
    /^Chapter\s+\d+[.\s]*(.*)$/im,
    // 序言/前言/楔子/尾声/番外
    /^(序言|前言|楔子|尾声|番外|后记|引子)/,
    // Volume / 卷
    /^[第终]?[卷部][\s zero-width]*[零一二三四五六七八九十百千万\d]+[.\s]*(.*)$/m
  ]

  // First pass: find all chapter boundaries
  const chapterStarts = []
  for (const pattern of chapterPatterns) {
    const regex = new RegExp(pattern.source, 'gm')
    let match
    while ((match = regex.exec(text)) !== null) {
      // Avoid duplicates at the same position
      if (!chapterStarts.find(c => c.pos === match.index)) {
        chapterStarts.push({
          pos: match.index,
          title: match[0].trim()
        })
      }
    }
  }

  // Sort by position
  chapterStarts.sort((a, b) => a.pos - b.pos)

  // If no chapters found, treat the whole file as one chapter
  if (chapterStarts.length === 0) {
    return {
      title,
      author,
      chapters: [{
        index: 0,
        title: '正文',
        content: cleanContent(text)
      }]
    }
  }

  // Build chapters
  const chapters = chapterStarts.map((start, i) => {
    const nextStart = chapterStarts[i + 1]
    const content = nextStart
      ? text.slice(start.pos + start.title.length, nextStart.pos)
      : text.slice(start.pos + start.title.length)

    return {
      index: i,
      title: start.title || `第${i + 1}章`,
      content: cleanContent(content)
    }
  })

  return { title, author, chapters }
}

/**
 * Detect encoding from Buffer and decode to string.
 * Priority: BOM markers → UTF-8 trial → GBK fallback.
 */
function detectAndDecode(buffer) {
  // ── BOM detection ──
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 BOM — strip and decode
    return buffer.slice(3).toString('utf-8').replace(/\r\n/g, '\n').trim()
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16 LE BOM
    return buffer.slice(2).toString('utf16le').replace(/\r\n/g, '\n').trim()
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE BOM
    return buffer.slice(2).toString('utf16be').replace(/\r\n/g, '\n').trim()
  }

  // ── Try UTF-8 ──
  const utf8 = buffer.toString('utf-8')
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length
  const totalChars = utf8.length

  // If < 1% replacement chars, UTF-8 is probably correct
  if (totalChars === 0 || replacementCount / totalChars < 0.01) {
    return utf8.replace(/\r\n/g, '\n').trim()
  }

  // ── Fallback: try GBK (Electron's Node has full ICU) ──
  try {
    const gbk = new TextDecoder('gbk', { fatal: false }).decode(buffer)
    return gbk.replace(/\r\n/g, '\n').trim()
  } catch {
    // TextDecoder 'gbk' not available — return UTF-8 as best-effort
    return utf8.replace(/\r\n/g, '\n').trim()
  }
}

/**
 * Clean chapter content: trim whitespace, collapse blank lines, remove leading/trailing noise.
 */
function cleanContent(text) {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter((l, i, arr) => {
      if (l === '') return i > 0 && arr[i - 1] !== ''
      return true
    })
    .join('\n')
    .trim()
}
