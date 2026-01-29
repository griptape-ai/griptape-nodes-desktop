import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'

export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error'
export type AppLogSource = 'main' | 'webview'

export interface AppLog {
  timestamp: Date
  level: AppLogLevel
  source: AppLogSource
  message: string
}

export class AppLogFileService extends EventEmitter {
  private writeStream: fs.WriteStream | null = null
  private sessionWriteStream: fs.WriteStream | null = null
  private logDir: string
  private currentLogPath: string
  private sessionLogPath: string
  private maxFileSize: number = 10 * 1024 * 1024 // 10MB
  private maxFiles: number = 4
  private isStarted: boolean = false

  constructor(logsBasePath: string) {
    super()
    this.logDir = path.join(logsBasePath, 'app')
    this.currentLogPath = path.join(this.logDir, 'app.log')
    this.sessionLogPath = path.join(this.logDir, 'session.log')
  }

  async start(): Promise<void> {
    if (this.isStarted) return
    await this.openLogFile()
    this.isStarted = true
    // Log startup - but avoid circular dependency by writing directly
    this.writeLog({
      timestamp: new Date(),
      level: 'info',
      source: 'main',
      message: 'AppLogFileService: Started',
    })
  }

  async writeLog(log: AppLog): Promise<void> {
    if (!this.isStarted) return

    await this.rotateIfNeeded()

    const entry = this.formatLogEntry(log)

    // Write to rotating log file
    if (this.writeStream) {
      this.writeStream.write(entry + '\n')
    }

    // Write to session log file
    if (this.sessionWriteStream) {
      this.sessionWriteStream.write(entry + '\n')
    }
  }

  /**
   * Helper to log from the main process
   */
  log(level: AppLogLevel, message: string): void {
    this.writeLog({
      timestamp: new Date(),
      level,
      source: 'main',
      message,
    })
  }

  /**
   * Helper to log from webview console messages
   */
  logWebview(level: AppLogLevel, message: string): void {
    this.writeLog({
      timestamp: new Date(),
      level,
      source: 'webview',
      message,
    })
  }

  private async openLogFile(): Promise<void> {
    try {
      await fs.promises.mkdir(this.logDir, { recursive: true })

      // Open rotating log file (append mode)
      this.writeStream = fs.createWriteStream(this.currentLogPath, { flags: 'a' })
      this.writeStream.on('error', (err) => {
        console.error('AppLogFileService: Write error (rotating):', err)
      })

      // Open session log file (overwrite mode - clears on each app start)
      this.sessionWriteStream = fs.createWriteStream(this.sessionLogPath, { flags: 'w' })
      this.sessionWriteStream.on('error', (err) => {
        console.error('AppLogFileService: Write error (session):', err)
      })
    } catch (err) {
      console.error('AppLogFileService: Failed to open log files:', err)
    }
  }

  private async closeLogFile(): Promise<void> {
    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(() => resolve())
      })
      this.writeStream = null
    }
    if (this.sessionWriteStream) {
      await new Promise<void>((resolve) => {
        this.sessionWriteStream!.end(() => resolve())
      })
      this.sessionWriteStream = null
    }
  }

  private formatLogEntry(log: AppLog): string {
    const timestamp = log.timestamp.toISOString()
    return `${timestamp} | ${log.level.padEnd(5)} | ${log.source.padEnd(7)} | ${log.message}`
  }

  private async rotateIfNeeded(): Promise<void> {
    if (!this.writeStream) return

    try {
      let stats: fs.Stats
      try {
        stats = await fs.promises.stat(this.currentLogPath)
      } catch {
        // File doesn't exist yet
        return
      }

      if (stats.size < this.maxFileSize) return

      // Close current file
      await this.closeLogFile()

      // Rotate files: delete oldest, shift others
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldPath = path.join(this.logDir, `app.${i}.log`)
        const newPath = path.join(this.logDir, `app.${i + 1}.log`)
        try {
          if (i === this.maxFiles - 1) {
            await fs.promises.unlink(oldPath).catch(() => {})
          } else {
            await fs.promises.rename(oldPath, newPath).catch(() => {})
          }
        } catch {
          // Ignore errors during rotation
        }
      }

      // Move current to .1
      try {
        await fs.promises.rename(this.currentLogPath, path.join(this.logDir, 'app.1.log'))
      } catch {
        // Ignore if rename fails
      }

      // Reopen new log file
      await this.openLogFile()

      this.writeLog({
        timestamp: new Date(),
        level: 'info',
        source: 'main',
        message: 'AppLogFileService: Log rotated',
      })
    } catch (err) {
      console.error('AppLogFileService: Rotation error:', err)
    }
  }

  /**
   * Export logs from the current session
   * @param targetPath - Where to save the exported logs
   */
  async exportSessionLogs(targetPath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(this.sessionLogPath, 'utf-8')
      await fs.promises.writeFile(targetPath, content, 'utf-8')
    } catch {
      // If session log doesn't exist, write empty file
      await fs.promises.writeFile(targetPath, '', 'utf-8')
    }
  }

  /**
   * Export all logs (rotating + current)
   * @param targetPath - Where to save the exported logs
   */
  async exportAllLogs(targetPath: string): Promise<void> {
    let combined = ''

    // Read in order (oldest first)
    for (const file of this.getLogFileNames()) {
      const filePath = path.join(this.logDir, file)
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        combined += content
      } catch {
        // File doesn't exist, skip
      }
    }

    await fs.promises.writeFile(targetPath, combined, 'utf-8')
  }

  getLogFilePath(): string {
    return this.currentLogPath
  }

  getSessionLogPath(): string {
    return this.sessionLogPath
  }

  getLogDir(): string {
    return this.logDir
  }

  /**
   * Get list of log files in order from oldest to newest
   */
  private getLogFileNames(): string[] {
    const files: string[] = []
    // Add rotated files from oldest to newest
    for (let i = this.maxFiles; i >= 1; i--) {
      files.push(`app.${i}.log`)
    }
    // Add current log file last (newest)
    files.push('app.log')
    return files
  }

  async destroy(): Promise<void> {
    await this.closeLogFile()
  }
}
