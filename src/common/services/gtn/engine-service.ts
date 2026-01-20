import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { getEnv } from '../../config/env'
import { getCwd, getUvExecutablePath } from '../../config/paths'
import { GtnService } from '../gtn/gtn-service'
import { SettingsService } from '../settings-service'
import { logger } from '@/main/utils/logger'

export type EngineStatus = 'not-ready' | 'ready' | 'initializing' | 'running' | 'error'

export type EngineStartupPhase =
  | 'not-started'
  | 'spawning'
  | 'initializing-python'
  | 'loading-libraries'
  | 'starting-server'
  | 'ready'
  | 'error'

export interface EngineLog {
  timestamp: Date
  type: 'stdout' | 'stderr'
  message: string
}

export interface EngineStartupProgress {
  phase: EngineStartupPhase
  message: string
  progress?: number // 0-100
  timestamp: Date
}

export interface EngineInternalState {
  phase: 'idle' | 'loading' | 'processing' | 'error'
  currentTask?: string
  progress?: number
  timestamp: Date
}

export interface ProcessMetrics {
  cpu: number // 0-100%
  memory: number // bytes
  memoryMB: number // MB
  pid: number
  elapsed: number // uptime in ms
  timestamp: number
}

interface EngineEvents {
  ready: []
  'engine:status-changed': [EngineStatus]
  'engine:log': [EngineLog]
  'engine:logs-cleared': []
  'engine:startup-progress': [EngineStartupProgress]
  'engine:state-changed': [EngineInternalState]
  'engine:process-metrics': [ProcessMetrics | null]
}

export class EngineService extends EventEmitter<EngineEvents> {
  private engineProcess: pty.IPty | null = null
  private status: EngineStatus = 'not-ready'
  private logs: EngineLog[] = []
  private maxLogSize = 1000 // Keep last 1000 log entries
  private restartAttempts = 0
  private maxRestartAttempts = 3
  private restartDelay = 5000 // 5 seconds
  private outputBuffer = '' // Buffer for incomplete lines from PTY
  private isReady: boolean = false

  // Startup progress tracking
  private startupProgress: EngineStartupProgress = {
    phase: 'not-started',
    message: '',
    timestamp: new Date()
  }

  // Internal state tracking
  private internalState: EngineInternalState = {
    phase: 'idle',
    timestamp: new Date()
  }

  // Process metrics tracking
  private metricsIntervalId: NodeJS.Timeout | null = null
  private engineStartTime: number = 0

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
   * Get startup progress
   */
  getStartupProgress(): EngineStartupProgress {
    return { ...this.startupProgress }
  }

  /**
   * Get internal state
   */
  getInternalState(): EngineInternalState {
    return { ...this.internalState }
  }

  /**
   * Get engine process PID (if running)
   */
  getProcessPid(): number | null {
    return this.engineProcess?.pid ?? null
  }

  /**
   * Write input to the engine PTY (for interactive commands)
   */
  writeToEngine(input: string): void {
    if (this.engineProcess) {
      this.engineProcess.write(input)
    }
  }

  /**
   * Resize the PTY terminal
   */
  resizeTerminal(cols: number, rows: number): void {
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
   * Update startup progress and emit event
   */
  private updateStartupProgress(progress: Partial<EngineStartupProgress>): void {
    this.startupProgress = {
      ...this.startupProgress,
      ...progress,
      timestamp: new Date()
    }
    this.emit('engine:startup-progress', this.startupProgress)
  }

  /**
   * Update internal state and emit event
   */
  private updateInternalState(state: Partial<EngineInternalState>): void {
    this.internalState = {
      ...this.internalState,
      ...state,
      timestamp: new Date()
    }
    this.emit('engine:state-changed', this.internalState)
  }

  /**
   * Parse output for startup phase indicators
   */
  private parseStartupPhase(message: string): void {
    const lowerMessage = message.toLowerCase()

    // Detect initialization phases from output
    if (
      lowerMessage.includes('initializing') ||
      lowerMessage.includes('setting up python') ||
      lowerMessage.includes('python environment')
    ) {
      this.updateStartupProgress({
        phase: 'initializing-python',
        message: 'Initializing Python environment...',
        progress: 30
      })
    } else if (
      lowerMessage.includes('loading') &&
      (lowerMessage.includes('librar') || lowerMessage.includes('node'))
    ) {
      this.updateStartupProgress({
        phase: 'loading-libraries',
        message: 'Loading node libraries...',
        progress: 60
      })
    } else if (
      lowerMessage.includes('starting server') ||
      lowerMessage.includes('uvicorn') ||
      lowerMessage.includes('listening')
    ) {
      this.updateStartupProgress({
        phase: 'starting-server',
        message: 'Starting web server...',
        progress: 80
      })
    } else if (
      lowerMessage.includes('ready to accept') ||
      lowerMessage.includes('server running') ||
      lowerMessage.includes('application startup complete')
    ) {
      this.updateStartupProgress({
        phase: 'ready',
        message: 'Engine ready',
        progress: 100
      })
    }
  }

  /**
   * Parse output for internal state indicators
   */
  private parseInternalState(message: string): void {
    // Example patterns to match GTN output
    const loadingMatch = message.match(/Loading workflow[:\s]+(.+)/i)
    if (loadingMatch) {
      this.updateInternalState({
        phase: 'loading',
        currentTask: loadingMatch[1].trim()
      })
      return
    }

    const processingMatch = message.match(/Processing node[:\s]+(.+?)(?:\s+\((\d+)\/(\d+)\))?/i)
    if (processingMatch) {
      const progress =
        processingMatch[2] && processingMatch[3]
          ? (parseInt(processingMatch[2]) / parseInt(processingMatch[3])) * 100
          : undefined
      this.updateInternalState({
        phase: 'processing',
        currentTask: processingMatch[1].trim(),
        progress
      })
      return
    }

    if (
      message.toLowerCase().includes('workflow complete') ||
      message.toLowerCase().includes('execution complete')
    ) {
      this.updateInternalState({
        phase: 'idle',
        currentTask: undefined,
        progress: undefined
      })
    }
  }

  /**
   * Start process metrics collection
   */
  private async startMetricsCollection(): Promise<void> {
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId)
    }

    // Dynamically import pidusage to avoid issues if not installed
    let pidusage: typeof import('pidusage') | null = null
    try {
      pidusage = await import('pidusage')
    } catch {
      logger.warn('[ENGINE] pidusage not available, process metrics disabled')
      return
    }

    this.metricsIntervalId = setInterval(async () => {
      const pid = this.engineProcess?.pid
      if (!pid || !pidusage) {
        this.emit('engine:process-metrics', null)
        return
      }

      try {
        const stats = await pidusage.default(pid)
        const metrics: ProcessMetrics = {
          cpu: Math.round(stats.cpu * 10) / 10,
          memory: stats.memory,
          memoryMB: Math.round((stats.memory / (1024 * 1024)) * 10) / 10,
          pid,
          elapsed: Date.now() - this.engineStartTime,
          timestamp: Date.now()
        }
        this.emit('engine:process-metrics', metrics)
      } catch {
        // Process may have exited
        this.emit('engine:process-metrics', null)
      }
    }, 1000)
  }

  /**
   * Stop process metrics collection
   */
  private stopMetricsCollection(): void {
    if (this.metricsIntervalId) {
      clearInterval(this.metricsIntervalId)
      this.metricsIntervalId = null
    }
    this.emit('engine:process-metrics', null)
  }

  /**
   * Start the engine using node-pty for proper terminal emulation
   */
  async startEngine(): Promise<void> {
    await this.waitForReady()

    // Update startup progress
    this.updateStartupProgress({
      phase: 'spawning',
      message: 'Starting engine process...',
      progress: 10
    })

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

      // Add debug flags if enabled
      if (this.settingsService.getEngineVerboseLogging?.()) {
        args.push('--verbose')
      }

      // Spawn the engine process using node-pty
      this.engineProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd,
        env: this.getEngineEnv() as { [key: string]: string }
      })

      this.engineStartTime = Date.now()

      // Start process metrics collection
      this.startMetricsCollection()

      logger.info(`[ENGINE] Engine process started with PID: ${this.engineProcess.pid}`)

      // Handle PTY data (combined stdout/stderr in PTY)
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
            // Log to file
            logger.info(`[GTN-ENGINE] ${line}`)

            // Parse for startup phases and internal state
            this.parseStartupPhase(line)
            this.parseInternalState(line)

            // Add to UI logs (PTY output is treated as stdout)
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

        // Stop metrics collection
        this.stopMetricsCollection()

        // Clean up
        this.engineProcess = null

        // Reset startup progress
        this.updateStartupProgress({
          phase: 'not-started',
          message: '',
          progress: undefined
        })

        // Auto-restart if it crashed unexpectedly
        if (this.status == 'ready') {
          // This means someone "stopped" the engine.
          this.restartAttempts = 0
          this.addLog('stdout', 'Engine stopped.')
        } else if (
          this.status == 'running' &&
          exitCode !== 0 &&
          this.restartAttempts < this.maxRestartAttempts
        ) {
          this.restartAttempts++
          this.addLog('stdout', `Engine process exited unexpectedly with exit code: ${exitCode}`)
          this.addLog(
            'stdout',
            `Attempting to restart engine (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`
          )
          setTimeout(() => this.startEngine(), this.restartDelay)
          this.setEngineStatus('ready')
        } else if (exitCode !== 0) {
          this.addLog('stderr', 'Maximum restart attempts reached. Engine will not auto-restart.')
          this.setEngineStatus('error')
          this.updateStartupProgress({
            phase: 'error',
            message: 'Engine failed to start'
          })
        }
      })
    } catch (error: any) {
      this.addLog('stderr', `Failed to start engine: ${error.message}`)
      this.setEngineStatus('error')
      this.updateStartupProgress({
        phase: 'error',
        message: `Failed to start: ${error.message}`
      })
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

    // Base environment with color-forcing variables
    const env: NodeJS.ProcessEnv = {
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

    // Add verbose logging environment variables if enabled
    if (this.settingsService.getEngineVerboseLogging?.()) {
      env.GTN_LOG_LEVEL = 'DEBUG'
      env.PYTHONVERBOSE = '1'
    }

    // Add debug mode environment variables if enabled
    if (this.settingsService.getEngineDebugMode?.()) {
      env.DEBUGPY_LISTEN_PORT = '5678'
      // Set to 'true' to block until debugger attaches
      env.DEBUGPY_WAIT_FOR_CLIENT = 'false'
    }

    return env
  }

  async stopEngine(): Promise<void> {
    if (!this.engineProcess) {
      return
    }

    if (this.status == 'running') {
      // Set status to ready so that the exit handler doesn't try to restart.
      this.setEngineStatus('ready')
    }

    // Stop metrics collection
    this.stopMetricsCollection()

    // Create a promise that resolves when the process actually exits
    const exitPromise = new Promise<void>((resolve) => {
      if (!this.engineProcess) {
        resolve()
        return
      }

      // node-pty uses onExit instead of 'exit' event listener
      const disposable = this.engineProcess.onExit(() => {
        disposable.dispose()
        resolve()
      })
    })

    // Try graceful shutdown first with SIGTERM (node-pty uses kill() method)
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
    this.stopMetricsCollection()
    await this.stopEngine()
    this.removeAllListeners()
  }

  /**
   * Get current process metrics (one-time query)
   */
  async getProcessMetrics(): Promise<ProcessMetrics | null> {
    const pid = this.engineProcess?.pid
    if (!pid) return null

    try {
      const pidusage = await import('pidusage')
      const stats = await pidusage.default(pid)
      return {
        cpu: Math.round(stats.cpu * 10) / 10,
        memory: stats.memory,
        memoryMB: Math.round((stats.memory / (1024 * 1024)) * 10) / 10,
        pid,
        elapsed: Date.now() - this.engineStartTime,
        timestamp: Date.now()
      }
    } catch {
      return null
    }
  }
}
