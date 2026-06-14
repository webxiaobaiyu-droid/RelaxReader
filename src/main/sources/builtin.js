export const builtinSources = [
  {
    id: 'xbiqugu',
    name: '香书小说',
    type: 'html',
    baseUrl: 'http://www.xbiqugu.la',
    searchUrl: 'http://www.xbiqugu.la/modules/article/waps.php',
    searchFallback: 'http://www.xbiqugu.la/modules/article/search.php',
    searchMethod: 'POST',
    searchBody: 'searchkey={keyword}',
    charset: 'utf-8',
    bookName: '#info h1@text',
    bookCover: '#fmimg img@src',
    bookDesc: '#intro p@text',
    chapterList: '#list dd a',
    chapterTitle: '@text',
    chapterUrl: '@href',
    content: '#content@content',
    searchList: 'table.grid tr',
    searchName: 'td.even a@text',
    searchAuthor: ''
  }
]
