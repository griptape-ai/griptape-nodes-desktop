import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import { EngineLog } from './gtn/engine-service'
import { SettingsService } from './settings-service'
import { logger } from '@/main/utils/logger'

export class EngineLogFileService extends EventEmitter {
  private isEnabled: boolean = false
  private writeStream: fs.WriteStream | null = null
  private sessionWriteStream: fs.WriteStream | null = null
  private logDir: string
  private currentLogPath: string
  private sessionLogPath: string
  private maxFileSize: number = 10 * 1024 * 1024 // 10MB
  private maxFiles: number = 4

  constructor(
    logsBasePath: string,
    private settingsService: SettingsService,
  ) {
    super()
    this.logDir = path.join(logsBasePath, 'engine')
    this.currentLogPath = path.join(this.logDir, 'engine.log')
    this.sessionLogPath = path.join(this.logDir, 'session.log')
  }

  async start(): Promise<void> {
    this.isEnabled = this.settingsService.getEngineLogFileEnabled()
    if (this.isEnabled) {
      await this.openLogFile()
    }
    // Clean up old logs based on retention setting
    await this.cleanupOldLogs()
    logger.info('EngineLogFileService: Started, enabled:', this.isEnabled)
  }

  async enable(): Promise<void> {
    if (this.isEnabled) return
    this.isEnabled = true
    this.settingsService.setEngineLogFileEnabled(true)
    await this.openLogFile()
    logger.info('EngineLogFileService: Enabled')
  }

  async disable(): Promise<void> {
    if (!this.isEnabled) return
    this.isEnabled = false
    this.settingsService.setEngineLogFileEnabled(false)
    await this.closeLogFile()
    logger.info('EngineLogFileService: Disabled')
  }

  isLoggingEnabled(): boolean {
    return this.isEnabled
  }

  async writeLog(log: EngineLog): Promise<void> {
    if (!this.isEnabled) return

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

  private async openLogFile(): Promise<void> {
    try {
      await fs.promises.mkdir(this.logDir, { recursive: true })

      // Open rotating log file (append mode)
      this.writeStream = fs.createWriteStream(this.currentLogPath, { flags: 'a' })
      this.writeStream.on('error', (err) => {
        logger.error('EngineLogFileService: Write error (rotating):', err)
      })

      // Open session log file (append mode - cleared via startNewSession when engine starts)
      this.sessionWriteStream = fs.createWriteStream(this.sessionLogPath, { flags: 'a' })
      this.sessionWriteStream.on('error', (err) => {
        logger.error('EngineLogFileService: Write error (session):', err)
      })
    } catch (err) {
      logger.error('EngineLogFileService: Failed to open log files:', err)
    }
  }

  /**
   * Start a new engine session - clears the session log file.
   * Should be called when the engine starts.
   */
  async startNewSession(): Promise<void> {
    if (!this.isEnabled) return

    // Close existing session stream and null the reference to prevent writes during transition
    if (this.sessionWriteStream) {
      const oldStream = this.sessionWriteStream
      this.sessionWriteStream = null
      await new Promise<void>((resolve) => {
        oldStream.end(() => resolve())
      })
    }

    // Reopen session log in overwrite mode to clear it
    try {
      this.sessionWriteStream = fs.createWriteStream(this.sessionLogPath, { flags: 'w' })
      this.sessionWriteStream.on('error', (err) => {
        logger.error('EngineLogFileService: Write error (session):', err)
      })
      logger.info('EngineLogFileService: Started new engine session')
    } catch (err) {
      logger.error('EngineLogFileService: Failed to start new session:', err)
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

  private formatLogEntry(log: EngineLog): string {
    const timestamp = log.timestamp.toISOString()
    const cleanMessage = this.stripAnsi(log.message)
    return `${timestamp} | ${log.type} | ${cleanMessage}`
  }

  private stripAnsi(message: string): string {
    return (
      message
        // Remove color and style SGR sequences
        .replace(/\x1b\[[0-9;]*m/g, '')
        // Remove cursor show/hide sequences
        .replace(/\x1b\[\?25[lh]/g, '')
        // Remove cursor positioning sequences
        .replace(/\x1b\[\d*[A-G]/g, '')
        // Remove Windows-specific ANSI sequences
        .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
        // Normalize Windows line endings
        .replace(/\r\n/g, '\n')
        // Remove standalone carriage returns
        .replace(/\r(?!\n)/g, '')
        // Replace braille spinner characters with bullet
        .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '•')
        // Remove OSC 8 hyperlinks but keep the display text
        .replace(/\]8;[^;]*;[^\x1b]*\x1b\\([^\x1b]*)\]8;;\x1b\\/g, '$1')
        // Fallback: remove OSC sequences that might have different terminators
        .replace(/\x1b\]8;[^;]*;[^\x07\x1b]*[\x07\x1b\\]/g, '')
        // Remove remaining control characters except newlines
        .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '')
    )
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
        const oldPath = path.join(this.logDir, `engine.${i}.log`)
        const newPath = path.join(this.logDir, `engine.${i + 1}.log`)
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
        await fs.promises.rename(this.currentLogPath, path.join(this.logDir, 'engine.1.log'))
      } catch {
        // Ignore if rename fails
      }

      // Reopen new log file
      await this.openLogFile()

      logger.info('EngineLogFileService: Log rotated')
    } catch (err) {
      logger.error('EngineLogFileService: Rotation error:', err)
    }
  }

  async exportLogs(targetPath: string): Promise<void> {
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
    logger.info('EngineLogFileService: Exported logs to:', targetPath)
  }

  /**
   * Get the date range of available logs
   * Returns { oldestDate, newestDate, availableDays } or null if no logs
   */
  async getLogDateRange(): Promise<{
    oldestDate: string
    newestDate: string
    availableDays: number
  } | null> {
    let oldestDate: Date | null = null
    let newestDate: Date | null = null

    for (const file of this.getLogFileNames()) {
      const filePath = path.join(this.logDir, file)
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        const lines = content.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          const timestamp = this.extractTimestamp(line)
          if (timestamp) {
            if (!oldestDate || timestamp < oldestDate) {
              oldestDate = timestamp
            }
            if (!newestDate || timestamp > newestDate) {
              newestDate = timestamp
            }
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    if (!oldestDate || !newestDate) {
      return null
    }

    const daysDiff = Math.ceil(
      (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    return {
      oldestDate: oldestDate.toISOString().split('T')[0],
      newestDate: newestDate.toISOString().split('T')[0],
      availableDays: Math.max(1, daysDiff + 1),
    }
  }

  /**
   * Export logs filtered by number of days
   * @param targetPath - Where to save the exported logs
   * @param days - Number of days to include (from today going back)
   */
  async exportLogsForDays(targetPath: string, days: number): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    cutoffDate.setHours(0, 0, 0, 0)

    let combined = ''

    // Read in order (oldest first)
    for (const file of this.getLogFileNames()) {
      const filePath = path.join(this.logDir, file)
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          if (!line.trim()) continue
          const timestamp = this.extractTimestamp(line)
          if (timestamp && timestamp >= cutoffDate) {
            combined += line + '\n'
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    await fs.promises.writeFile(targetPath, combined, 'utf-8')
    logger.info(`EngineLogFileService: Exported ${days} day(s) of logs to:`, targetPath)
  }

  /**
   * Export logs from the current session
   * @param targetPath - Where to save the exported logs
   */
  async exportSessionLogs(targetPath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(this.sessionLogPath, 'utf-8')
      await fs.promises.writeFile(targetPath, content, 'utf-8')
      logger.info('EngineLogFileService: Exported session logs to:', targetPath)
    } catch {
      // If session log doesn't exist, write empty file
      await fs.promises.writeFile(targetPath, '', 'utf-8')
      logger.info('EngineLogFileService: No session logs to export')
    }
  }

  /**
   * Export logs between two timestamps
   * @param targetPath - Where to save the exported logs
   * @param startTime - Start of the range (ISO string)
   * @param endTime - End of the range (ISO string)
   */
  async exportLogsForRange(targetPath: string, startTime: string, endTime: string): Promise<void> {
    const startDate = new Date(startTime)
    const endDate = new Date(endTime)

    let combined = ''

    // Read in order (oldest first)
    for (const file of this.getLogFileNames()) {
      const filePath = path.join(this.logDir, file)
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          if (!line.trim()) continue
          const timestamp = this.extractTimestamp(line)
          if (timestamp && timestamp >= startDate && timestamp <= endDate) {
            combined += line + '\n'
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    await fs.promises.writeFile(targetPath, combined, 'utf-8')
    logger.info(
      `EngineLogFileService: Exported logs from ${startTime} to ${endTime} to:`,
      targetPath,
    )
  }

  /**
   * Export logs from a timestamp to now
   * @param targetPath - Where to save the exported logs
   * @param sinceTime - Start timestamp (ISO string)
   */
  async exportLogsSince(targetPath: string, sinceTime: string): Promise<void> {
    const sinceDate = new Date(sinceTime)

    let combined = ''

    // Read in order (oldest first)
    for (const file of this.getLogFileNames()) {
      const filePath = path.join(this.logDir, file)
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          if (!line.trim()) continue
          const timestamp = this.extractTimestamp(line)
          if (timestamp && timestamp >= sinceDate) {
            combined += line + '\n'
          }
        }
      } catch {
        // File doesn't exist, skip
      }
    }

    await fs.promises.writeFile(targetPath, combined, 'utf-8')
    logger.info(`EngineLogFileService: Exported logs since ${sinceTime} to:`, targetPath)
  }

  private extractTimestamp(line: string): Date | null {
    // Log format: 2024-01-15T10:30:45.123Z | stdout | message
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/)
    if (match) {
      try {
        return new Date(match[1])
      } catch {
        return null
      }
    }
    return null
  }

  getLogFilePath(): string {
    return this.currentLogPath
  }

  getLogDir(): string {
    return this.logDir
  }

  /**
   * Format in-memory logs for export (strips ANSI codes)
   */
  formatLogsForExport(logs: EngineLog[]): string {
    return logs.map((log) => this.formatLogEntry(log)).join('\n')
  }

  /**
   * Get list of log files in order from oldest to newest
   */
  private getLogFileNames(): string[] {
    const files: string[] = []
    // Add rotated files from oldest to newest
    for (let i = this.maxFiles; i >= 1; i--) {
      files.push(`engine.${i}.log`)
    }
    // Add current log file last (newest)
    files.push('engine.log')
    return files
  }

  async destroy(): Promise<void> {
    await this.closeLogFile()
  }

  /**
   * Clean up log files older than the retention period.
   * This removes entire log files that are completely outside the retention window.
   */
  async cleanupOldLogs(): Promise<void> {
    const cutoffDate = this.settingsService.getLogRetentionCutoffDate()
    if (!cutoffDate) {
      // Indefinite retention, no cleanup needed
      return
    }

    try {
      const files = await fs.promises.readdir(this.logDir)
      const logFiles = files.filter(
        (f) => f.startsWith('engine.') && f.endsWith('.log') && f !== 'session.log',
      )

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file)
        try {
          const stats = await fs.promises.stat(filePath)
          // If file was last modified before cutoff, check if all entries are old
          if (stats.mtime < cutoffDate) {
            // Read file and check newest entry
            const content = await fs.promises.readFile(filePath, 'utf-8')
            const lines = content.split('\n').filter((line) => line.trim())
            if (lines.length === 0) {
              // Empty file, delete it
              await fs.promises.unlink(filePath)
              logger.info(`EngineLogFileService: Deleted empty log file: ${file}`)
              continue
            }

            // Check the newest entry (last line)
            const lastLine = lines[lines.length - 1]
            const newestTimestamp = this.extractTimestamp(lastLine)
            if (newestTimestamp && newestTimestamp < cutoffDate) {
              // All entries in this file are older than cutoff
              await fs.promises.unlink(filePath)
              logger.info(`EngineLogFileService: Deleted old log file: ${file}`)
            }
          }
        } catch (err) {
          // Skip files that can't be read
          logger.warn(`EngineLogFileService: Could not process log file ${file}:`, err)
        }
      }
    } catch (err) {
      logger.error('EngineLogFileService: Failed to cleanup old logs:', err)
    }
  }
}
