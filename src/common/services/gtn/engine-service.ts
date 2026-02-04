import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { getEnv } from '../../config/env'
import { getCwd, getUvExecutablePath } from '../../config/paths'
import { GtnService } from '../gtn/gtn-service'
import { SettingsService } from '../settings-service'
import { logger } from '@/main/utils/logger'

export type EngineStatus = 'not-ready' | 'ready' | 'initializing' | 'running' | 'error'

export interface EngineLog {
  timestamp: Date
  type: 'stdout' | 'stderr'
  message: string
}

interface EngineEvents {
  ready: []
  'engine:status-changed': [EngineStatus]
  'engine:log': [EngineLog]
  'engine:logs-cleared': []
}

export class EngineService extends EventEmitter<EngineEvents> {
  private engineProcess: pty.IPty | null = null
  private status: EngineStatus = 'not-ready'
  private logs: EngineLog[] = []
  private maxLogSize = 1000 // Keep last 1000 log entries
  private restartDelay = 5000 // 5 seconds
  private outputBuffer = '' // Buffer for incomplete lines from PTY
  private isReady: boolean = false
  // Terminal dimensions - used when spawning PTY and updated via resize
  private terminalCols = 120
  private terminalRows = 50

  constructor(
    private userDataDir: string,
    private gtnService: GtnService,
    private settingsService: SettingsService,
  ) {
    super()
  }

  async start() {
    logger.info('engine service start')
    await this.gtnService.waitForReady()

    this.isReady = true
    this.emit('ready')
    this.setEngineStatus('ready')
    logger.info('engine service ready')
  }

  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.once('ready', resolve))
  }

  /**
   * Get current engine status
   */
  getStatus(): EngineStatus {
    return this.status
  }

  /**
   * Set engine to initializing state (used during background setup)
   */
  setInitializing(): void {
    this.status = 'initializing'
    this.addLog('stdout', 'Setting up Griptape Nodes environment...')
    this.emit('engine:status-changed', this.status)
  }

  /**
   * Set engine to error state (used when setup fails)
   */
  setError(): void {
    this.status = 'error'
    this.emit('engine:status-changed', this.status)
  }

  /**
   * Get engine logs
   */
  getLogs(): EngineLog[] {
    return [...this.logs]
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = []
    this.emit('engine:logs-cleared')
  }

  /**
   * Resize the PTY terminal. This sends SIGWINCH to the child process,
   * causing programs like Rich to reflow their output for the new width.
   * Also stores the size for use when spawning new processes.
   */
  resizeTerminal(cols: number, rows: number): void {
    this.terminalCols = cols
    this.terminalRows = rows
    if (this.engineProcess) {
      this.engineProcess.resize(cols, rows)
    }
  }

  /**
   * Add a log entry
   */
  addLog(type: 'stdout' | 'stderr', message: string): void {
    // Clean up control sequences that shouldn't be displayed
    let cleanMessage = message
    // TODO: [Add back engine log colors cross platform](https://github.com/griptape-ai/griptape-nodes-desktop/issues/31)
    // // Remove cursor show/hide sequences
    // .replace(/\x1b\[\?25[lh]/g, '')
    // // Remove other cursor control sequences
    // .replace(/\x1b\[\d*[ABCDEFGHJKST]/gi, '')
    // // Remove clear line/screen sequences
    // .replace(/\x1b\[2?[JK]/gi, '')
    // // Remove save/restore cursor position
    // .replace(/\x1b\[[su]/gi, '')
    // // Remove Windows-specific ANSI sequences
    // // .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
    // // Remove color reset and other SGR sequences
    // .replace(/\x1b\[\d*;?\d*;?\d*;?\d*m/g, '')
    // // Remove bracketed paste mode
    // .replace(/\x1b\[\?2004[lh]/g, '')
    // // Clean up any remaining escape sequences we don't handle
    // .replace(/\x1b\[\?\d+[lh]/g, '')
    // // Handle Windows line endings properly
    // .replace(/\r\n/g, '\n')
    // .replace(/\r(?!\n)/g, '');
    // Don't process OSC 8 hyperlinks here - let the frontend handle them
    // This preserves them for conversion to clickable links in the UI

    // cleanMessage = cleanMessage.trim();

    // // Skip empty messages after cleaning
    // if (!cleanMessage) {
    //   return;
    // }

    const log: EngineLog = {
      timestamp: new Date(),
      type,
      message: cleanMessage,
    }

    this.logs.push(log)

    // Trim logs if they exceed max size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize)
    }

    this.emit('engine:log', log)
  }

  /**
   * Start the engine using node-pty for proper terminal emulation.
   * This makes the child process think it's connected to a real terminal,
   * so programs output ANSI colors without needing environment variable hacks.
   */
  async startEngine(): Promise<void> {
    await this.waitForReady()

    // Check if a local engine path is configured for development
    const localEnginePath = this.settingsService.getLocalEnginePath()

    this.setEngineStatus('running')

    try {
      // Clear logs from previous session when starting fresh
      this.logs = []
      this.outputBuffer = ''

      let command: string
      let args: string[]
      let cwd: string

      if (localEnginePath) {
        // Use local development mode: run via uv from the local repository
        const uvPath = getUvExecutablePath(this.userDataDir)
        command = uvPath
        args = ['run', 'gtn', '--no-update']
        cwd = localEnginePath
        logger.info('[ENGINE] Starting Griptape Nodes engine in LOCAL DEV mode...')
        logger.info(`[ENGINE] Local repo path: ${localEnginePath}`)
        logger.info(`[ENGINE] Command: ${uvPath} run gtn --no-update`)
        this.addLog('stdout', `Running from local repository: ${localEnginePath}`)
      } else {
        // Use installed mode: run the installed gtn executable
        const gtnPath = await this.gtnService.getGtnExecutablePath()
        command = gtnPath
        args = ['--no-update']
        cwd = getCwd(this.userDataDir)
        logger.info('[ENGINE] Starting Griptape Nodes engine...')
        logger.info(`[ENGINE] Command: ${gtnPath} --no-update`)
      }

      // Spawn the engine process using node-pty for proper TTY emulation
      logger.info(`[ENGINE] Spawning with terminal size: ${this.terminalCols}x${this.terminalRows}`)
      this.engineProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: this.terminalCols,
        rows: this.terminalRows,
        cwd,
        env: this.getEngineEnv() as { [key: string]: string },
      })

      logger.info(`[ENGINE] Engine process started with PID: ${this.engineProcess.pid}`)

      // Handle PTY data (stdout and stderr are combined in a PTY)
      this.engineProcess.onData((data) => {
        this.outputBuffer += data

        // Handle both Windows CRLF and Unix LF line endings
        this.outputBuffer = this.outputBuffer.replace(/\r\n/g, '\n')

        // Handle carriage returns (\r) which are used for progress indicators
        // Split by \r to handle overwrites, keeping only the last one
        const carriageReturnParts = this.outputBuffer.split('\r')
        if (carriageReturnParts.length > 1) {
          // Keep only the last part after \r (this is what should be displayed)
          this.outputBuffer = carriageReturnParts[carriageReturnParts.length - 1]
        }

        const lines = this.outputBuffer.split('\n')

        // Keep the last incomplete line in the buffer
        this.outputBuffer = lines.pop() || ''

        // Process complete lines
        lines.forEach((line) => {
          if (line.trim().length > 0) {
            // Log to main process logger
            logger.info(`[GTN-ENGINE] ${line}`)
            // Add to UI logs (PTY combines stdout/stderr, so we treat all as stdout)
            this.addLog('stdout', line)
          }
        })
      })

      // Handle process exit
      this.engineProcess.onExit(({ exitCode }) => {
        // Flush any remaining buffered data
        if (this.outputBuffer.trim().length > 0) {
          this.addLog('stdout', this.outputBuffer)
          this.outputBuffer = ''
        }

        this.engineProcess = null

        // Handle process exit based on current status
        if (this.status === 'ready') {
          // Intentional stop via stopEngine()
          this.addLog('stdout', 'Engine stopped.')
        } else if (this.status === 'running') {
          if (exitCode === 0) {
            // Engine exited gracefully on its own
            this.addLog('stdout', 'Engine exited gracefully.')
            this.setEngineStatus('ready')
          } else {
            // Engine crashed - auto-restart
            this.addLog('stdout', `Engine process exited unexpectedly with exit code: ${exitCode}`)
            this.addLog('stdout', 'Attempting to restart engine...')
            this.setEngineStatus('ready')
            setTimeout(() => this.startEngine(), this.restartDelay)
          }
        } else if (this.status === 'initializing') {
          // Engine exited during initialization
          this.addLog('stderr', `Engine exited during initialization with exit code: ${exitCode}`)
          this.setEngineStatus('error')
        } else if (this.status === 'error') {
          // Already in error state, just log
          this.addLog('stderr', `Engine exited while in error state with exit code: ${exitCode}`)
        }
      })
    } catch (error: any) {
      this.addLog('stderr', `Failed to start engine: ${error.message}`)
      this.setEngineStatus('error')
    }
  }

  private setEngineStatus(status: EngineStatus) {
    if (status == this.status) {
      return
    }
    this.status = status
    this.emit('engine:status-changed', status)
  }

  /**
   * Get environment variables for the engine process with color support
   */
  private getEngineEnv(): NodeJS.ProcessEnv {
    // Start with base environment but filter out color-disabling variables
    const baseEnv = getEnv(this.userDataDir)
    const filteredEnv: NodeJS.ProcessEnv = {}

    // Copy all env vars except ones that disable colors
    for (const [key, value] of Object.entries(baseEnv)) {
      const upperKey = key.toUpperCase()
      // Skip color-disabling variables
      if (upperKey === 'NO_COLOR' || upperKey === 'NOCOLOR') {
        continue
      }
      filteredEnv[key] = value
    }

    // Add color-forcing environment variables
    return {
      ...filteredEnv,
      // Force color output - these should be respected by most tools
      FORCE_COLOR: 'true',
      CLICOLOR: '1',
      CLICOLOR_FORCE: '1',
      PY_COLORS: '1',
      COLORTERM: 'truecolor',
      // Rich library specific - must be string 'true' not '1'
      RICH_FORCE_TERMINAL: 'true',
      // Colorama (Windows) - don't strip or convert ANSI codes, output them raw
      COLORAMA_STRIP: 'False',
      COLORAMA_CONVERT: 'False',
      ANSI_COLORS_DISABLED: '0',
      // Ensure Python output is unbuffered
      PYTHONUNBUFFERED: '1',
      // Terminal type for ANSI support
      TERM: 'xterm-256color',
      // Fix Windows Unicode encoding issues
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    }
  }

  async stopEngine(): Promise<void> {
    if (!this.engineProcess) {
      return
    }

    if (this.status == 'running') {
      // Set status to ready so that the exit handler doesn't try to restart.
      this.setEngineStatus('ready')
    }

    // Create a promise that resolves when the process actually exits
    const exitPromise = new Promise<void>((resolve) => {
      if (!this.engineProcess) {
        resolve()
        return
      }

      // node-pty uses onExit with a disposable pattern
      const disposable = this.engineProcess.onExit(() => {
        disposable.dispose()
        resolve()
      })
    })

    // Try graceful shutdown first with SIGTERM
    logger.info('[ENGINE] Sending SIGTERM to engine process...')
    this.engineProcess.kill('SIGTERM')

    // Wait up to 3 seconds for graceful shutdown
    const gracefulShutdown = await Promise.race([
      exitPromise.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000)),
    ])

    // Force kill with SIGKILL if process still exists after grace period
    if (!gracefulShutdown && this.engineProcess) {
      logger.info('[ENGINE] Graceful shutdown timed out, sending SIGKILL...')
      this.engineProcess.kill('SIGKILL')
      // Wait for the process to actually exit after SIGKILL
      await exitPromise
    }

    // On Windows, add a small delay to ensure file handles are fully released
    // by the OS after the process exits
    if (process.platform === 'win32') {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    logger.info('[ENGINE] Engine process stopped')
  }

  async restartEngine(): Promise<void> {
    this.addLog('stdout', 'Restarting Griptape Nodes engine...')
    await this.stopEngine()
    await this.startEngine()
  }

  async destroy(): Promise<void> {
    await this.stopEngine()
    this.removeAllListeners()
  }
}
