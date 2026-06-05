import Store from 'electron-store'

const libStore = new Store({
  name: 'library',
  defaults: {
    books: [],
    settings: {
      theme: 'light',
      fontSize: 18,
      lineHeight: 1.8,
      readingMode: 'scroll'
    }
  }
})

export default libStore
