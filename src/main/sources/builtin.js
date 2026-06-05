/**
 * Built-in book sources.
 *
 * Each source defines how to search and fetch content from a website.
 * Uses simple CSS-selector-like syntax with @ operators:
 *   tag.class@text  → element's text content
 *   img@src         → src attribute
 *   a@href          → href attribute
 *   div@html        → inner HTML
 *   div@content     → text with <br>→\n conversion
 */

export const builtinSources = [
  {
    id: 'xbiqugu',
    name: '香书小说',
    baseUrl: 'http://www.xbiqugu.la',
    searchUrl: 'http://www.xbiqugu.la/modules/article/waps.php',
    searchMethod: 'POST',
    searchBody: 'searchkey={keyword}',
    charset: 'utf-8',
    // Search result extraction
    searchList: '#main > ul > li',
    bookTitle: 'a@text',
    bookAuthor: '.author@text',
    bookUrl: 'a@href',
    // Book detail
    bookName: '#info h1@text',
    bookAuthorDetail: '#info p@text',
    bookCover: '#fmimg img@src',
    bookDesc: '#intro p@text',
    // Chapter list
    chapterList: '#list dd a',
    chapterTitle: '@text',
    chapterUrl: '@href',
    // Chapter content
    content: '#content@content'
  }
]
