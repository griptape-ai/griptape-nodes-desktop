import log from 'electron-log/renderer'
import { Logger } from '../../common/utils/logger.types'

// Defaults to ~/Library/Logs/<AppName>/renderer.log
export const logger: Logger = {
  debug: (...args) => log.debug(...args),
  info: (...args) => log.info(...args),
  warn: (...args) => log.warn(...args),
  error: (...args) => log.error(...args),
  fatal: (err) => {
    if (err instanceof Error) {
      log.error('Fatal:', err.stack || err.message)
    } else {
      log.error('Fatal:', err)
    }
  },
}
