import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { attachOutputForwarder } from '../../child-process/output-forwarder'
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
  private engineProcess: ChildProcess | null = null
  private status: EngineStatus = 'not-ready'
  private logs: EngineLog[] = []
  private maxLogSize = 1000 // Keep last 1000 log entries
  private restartAttempts = 0
  private maxRestartAttempts = 3
  private restartDelay = 5000 // 5 seconds
  private stdoutBuffer = '' // Buffer for incomplete stdout lines
  private stderrBuffer = '' // Buffer for incomplete stderr lines
  private isReady: boolean = false

  constructor(
    private userDataDir: string,
    private gtnService: GtnService,
    private settingsService: SettingsService
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
      message: cleanMessage
    }

    this.logs.push(log)

    // Trim logs if they exceed max size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize)
    }

    this.emit('engine:log', log)
  }

  /**
   * Start the engine
   */
  async startEngine(): Promise<void> {
    await this.waitForReady()

    // Check if a local engine path is configured for development
    const localEnginePath = this.settingsService.getLocalEnginePath()

    this.setEngineStatus('running')

    try {
      // Clear logs from previous session when starting fresh
      this.logs = []

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

      // Spawn the engine process
      this.engineProcess = spawn(command, args, {
        cwd,
        env: this.getEngineEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })

      attachOutputForwarder(this.engineProcess, { logPrefix: 'GTN-ENGINE' })

      // Handle stdout with line buffering and carriage return handling
      this.engineProcess.stdout?.on('data', (data) => {
        this.stdoutBuffer += data.toString('utf8')

        // Handle both Windows CRLF and Unix LF line endings
        // First normalize Windows line endings
        this.stdoutBuffer = this.stdoutBuffer.replace(/\r\n/g, '\n')

        // Handle carriage returns (\r) which are used for progress indicators
        // Split by \r to handle overwrites, keeping only the last one
        const carriageReturnParts = this.stdoutBuffer.split('\r')
        if (carriageReturnParts.length > 1) {
          // Keep only the last part after \r (this is what should be displayed)
          this.stdoutBuffer = carriageReturnParts[carriageReturnParts.length - 1]
        }

        const lines = this.stdoutBuffer.split('\n')

        // Keep the last incomplete line in the buffer
        this.stdoutBuffer = lines.pop() || ''

        // Process complete lines
        lines.forEach((line) => {
          if (line.trim().length > 0) {
            this.addLog('stdout', line)
          }
        })
      })

      // Handle stderr with line buffering and carriage return handling
      this.engineProcess.stderr?.on('data', (data) => {
        this.stderrBuffer += data.toString('utf8')

        // Handle both Windows CRLF and Unix LF line endings
        // First normalize Windows line endings
        this.stderrBuffer = this.stderrBuffer.replace(/\r\n/g, '\n')

        // Handle carriage returns (\r) which are used for progress indicators
        // Split by \r to handle overwrites, keeping only the last one
        const carriageReturnParts = this.stderrBuffer.split('\r')
        if (carriageReturnParts.length > 1) {
          // Keep only the last part after \r (this is what should be displayed)
          this.stderrBuffer = carriageReturnParts[carriageReturnParts.length - 1]
        }

        const lines = this.stderrBuffer.split('\n')

        // Keep the last incomplete line in the buffer
        this.stderrBuffer = lines.pop() || ''

        // Process complete lines
        lines.forEach((line) => {
          if (line.trim().length > 0) {
            this.addLog('stderr', line)
          }
        })
      })

      // Handle process exit
      this.engineProcess.once('exit', (code, _signal) => {
        // Flush any remaining buffered data
        if (this.stdoutBuffer.trim().length > 0) {
          this.addLog('stdout', this.stdoutBuffer)
          this.stdoutBuffer = ''
        }
        if (this.stderrBuffer.trim().length > 0) {
          this.addLog('stderr', this.stderrBuffer)
          this.stderrBuffer = ''
        }

        // Clean up the process and its listeners
        this.engineProcess?.removeAllListeners()
        this.engineProcess?.stdout?.removeAllListeners()
        this.engineProcess?.stderr?.removeAllListeners()
        // Explicitly destroy streams to release file handles (important for Windows)
        this.engineProcess?.stdout?.destroy()
        this.engineProcess?.stderr?.destroy()
        this.engineProcess?.stdin?.destroy()
        this.engineProcess = null

        // Auto-restart if it crashed unexpectedly
        if (this.status == 'ready') {
          // This means someone "stopped" the engine.
          this.restartAttempts = 0
          this.addLog('stdout', 'Engine stopped.')
        } else if (
          this.status == 'running' &&
          code !== 0 &&
          this.restartAttempts < this.maxRestartAttempts
        ) {
          this.restartAttempts++
          this.addLog('stdout', `Engine process exited unexpected with exit code: ${code}`)
          this.addLog(
            'stdout',
            `Attempting to restart engine (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`
          )
          setTimeout(() => this.startEngine(), this.restartDelay)
          this.setEngineStatus('ready')
        } else {
          this.addLog('stderr', 'Maximum restart attempts reached. Engine will not auto-restart.')
          this.setEngineStatus('error')
        }
      })

      // Handle process error
      this.engineProcess.on('error', (error) => {
        this.addLog('stderr', `Engine process error: ${error}`)
        this.setEngineStatus('error')
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
      PYTHONUTF8: '1'
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

      const onExit = () => {
        resolve()
      }

      // Listen for the exit event
      this.engineProcess.once('exit', onExit)

      // Also handle the case where the process is already dead
      // but we haven't received the exit event yet
      if (this.engineProcess.exitCode !== null || this.engineProcess.killed) {
        this.engineProcess.removeListener('exit', onExit)
        resolve()
      }
    })

    // Try graceful shutdown first with SIGTERM.
    logger.info('[ENGINE] Sending SIGTERM to engine process...')
    this.engineProcess.kill('SIGTERM')

    // Wait up to 3 seconds for graceful shutdown
    const gracefulShutdown = await Promise.race([
      exitPromise.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000))
    ])

    // Force kill with SIGKILL if process still exists after grace period.
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
