import { registerDialogHandlers } from './dialog.js'
import { registerFsHandlers } from './fs.js'
import { registerStoreHandlers } from './store.js'
import { registerWindowHandlers } from './window.js'
import { registerBookHandlers } from './book.js'
import { registerSourceHandlers } from './source.js'

export function registerIpcHandlers() {
  registerDialogHandlers()
  registerFsHandlers()
  registerStoreHandlers()
  registerWindowHandlers()
  registerBookHandlers()
  registerSourceHandlers()
}
