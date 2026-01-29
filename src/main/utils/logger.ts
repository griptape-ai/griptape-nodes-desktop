import path from 'path'
import { app } from 'electron'
import log from 'electron-log/main'
import type Logger from 'electron-log'
import { Logger as LoggerType } from '../../common/utils/logger.types'
import { AppLogFileService, AppLogLevel } from '../../common/services/app-log-file-service'

// Configure output file (~/Library/Logs/<AppName>/main.log on macOS)
log.transports.file.resolvePathFn = () => path.join(app.getPath('logs'), 'main.log')

log.transports.file.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info'

// Reference to app log file service for forwarding logs
let appLogFileService: AppLogFileService | null = null

/**
 * Set the AppLogFileService instance to forward main process logs to the app log file
 */
export function setAppLogFileService(service: AppLogFileService): void {
  appLogFileService = service
}

// Map electron-log levels to our app log levels
const levelMap: Record<Logger.LogLevel, AppLogLevel> = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  verbose: 'debug',
  debug: 'debug',
  silly: 'debug',
}

// Add hook to forward logs to AppLogFileService
log.hooks.push((message) => {
  if (appLogFileService && message.level) {
    const level = levelMap[message.level] || 'info'
    const text = message.data
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(' ')
    appLogFileService.log(level, text)
  }
  return message
})

export const logger: LoggerType = {
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
    // Hook: send to Sentry or another crash reporter
  },
}
