import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { PythonService } from '../python-service';
import { GtnService } from '../gtn-service';
import { attachOutputForwarder } from '../../utils/child-process/output-forwarder';
import { getGtnExecutablePath } from '../config/paths';
import { getEnv } from '../config/env';

export type EngineStatus = 'not-ready' | 'ready' | 'initializing' | 'running' | 'error';

export interface EngineLog {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
}

export class EngineService extends EventEmitter {
  private pythonService: PythonService;
  private gtnService: GtnService;
  private userDataDir: string;
  private engineProcess: ChildProcess | null = null;
  private status: EngineStatus = 'not-ready';
  private logs: EngineLog[] = [];
  private maxLogSize = 1000; // Keep last 1000 log entries
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private restartDelay = 5000; // 5 seconds
  private stdoutBuffer = ''; // Buffer for incomplete stdout lines
  private stderrBuffer = ''; // Buffer for incomplete stderr lines

  constructor(pythonService: PythonService, gtnService: GtnService, userDataDir: string) {
    super();
    this.pythonService = pythonService;
    this.gtnService = gtnService;
    this.userDataDir = userDataDir;
    this.checkStatus();
  }

  /**
   * Get current engine status
   */
  getStatus(): EngineStatus {
    return this.status;
  }

  /**
   * Set engine to initializing state (used during background setup)
   */
  setInitializing(): void {
    this.status = 'initializing';
    this.addLog('stdout', 'Setting up Griptape Nodes environment...');
    this.emit('status-changed', this.status);
  }

  /**
   * Get engine logs
   */
  getLogs(): EngineLog[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    this.emit('logs-cleared');
  }

  /**
   * Check if gtn init has been run
   */
  private isInitialized(): boolean {
    return this.gtnService.isInitialized();
  }

  /**
   * Check and update engine status
   */
  checkStatus(): void {
    console.warn("checkStatus not yet implemented");
    // const oldStatus = this.status;
    // console.log('[ENGINE] Checking status...');

    // const gtnReady = this.pythonService.isGriptapeNodesReady();
    // console.log('[ENGINE] Griptape-nodes ready:', gtnReady);
    // if (!gtnReady) {
    //   // Don't override initializing status if we're in the middle of setup
    //   if (this.status !== 'initializing') {
    //     this.status = 'not-ready';
    //     this.addLog('stderr', 'Griptape Nodes is not installed');
    //   }
    // } else if (!this.isInitialized()) {
    //   const isInit = this.isInitialized();
    //   console.log('[ENGINE] Griptape-nodes initialized:', isInit);
    //   this.status = 'not-ready';
    //   this.addLog('stderr', 'Griptape Nodes not initialized. Run "gtn init" first.');
    // } else if (this.engineProcess && !this.engineProcess.killed) {
    //   this.status = 'running';
    // } else {
    //   this.status = 'ready';
    // }

    // if (oldStatus !== this.status) {
    //   console.log('[ENGINE] Status changed from', oldStatus, 'to', this.status);
    //   this.emit('status-changed', this.status);
    // } else {
    //   console.log('[ENGINE] Status unchanged:', this.status);
    // }
  }

  /**
   * Add a log entry
   */
  private addLog(type: 'stdout' | 'stderr', message: string): void {
    // Clean up control sequences that shouldn't be displayed
    let cleanMessage = message
      // Remove cursor show/hide sequences
      .replace(/\x1b\[\?25[lh]/g, '')
      // Remove other cursor control sequences
      .replace(/\x1b\[\d*[ABCDEFGHJKST]/gi, '')
      // Remove clear line/screen sequences
      .replace(/\x1b\[2?[JK]/gi, '')
      // Remove save/restore cursor position
      .replace(/\x1b\[[su]/gi, '')
      // Remove Windows-specific ANSI sequences
      .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
      // Remove color reset and other SGR sequences
      .replace(/\x1b\[\d*;?\d*;?\d*;?\d*m/g, '')
      // Remove bracketed paste mode
      .replace(/\x1b\[\?2004[lh]/g, '')
      // Clean up any remaining escape sequences we don't handle
      .replace(/\x1b\[\?\d+[lh]/g, '')
      // Handle Windows line endings properly
      .replace(/\r\n/g, '\n')
      .replace(/\r(?!\n)/g, '');

    // Don't process OSC 8 hyperlinks here - let the frontend handle them
    // This preserves them for conversion to clickable links in the UI

    cleanMessage = cleanMessage.trim();

    // Skip empty messages after cleaning
    if (!cleanMessage) {
      return;
    }

    const log: EngineLog = {
      timestamp: new Date(),
      type,
      message: cleanMessage
    };

    this.logs.push(log);

    // Trim logs if they exceed max size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    this.emit('log', log);
  }

  /**
   * Start the engine
   */
  async start(): Promise<void> {
    if (this.status === 'not-ready') {
      throw new Error('Engine cannot be started. Griptape Nodes is not ready.');
    }

    if (this.status === 'running') {
      console.log('Engine is already running');
      return;
    }

    try {
      const gtnPath = getGtnExecutablePath(this.userDataDir);

      // Clear logs from previous session when starting fresh
      this.logs = [];
      this.addLog('stdout', 'Starting Griptape Nodes engine...');
      console.log('[ENGINE] Starting Griptape Nodes engine...');
      console.log(`[ENGINE] Command: ${gtnPath} engine`);

      // Spawn the engine process from config directory so it finds the config file
      this.engineProcess = spawn(gtnPath, ['--no-update', 'engine'], {
        env: {
          ...getEnv(this.userDataDir),
          // Force color output for terminals that support it
          FORCE_COLOR: '1',
          RICH_FORCE_TERMINAL: "1",
          PYTHONUNBUFFERED: '1',
          // Help with Windows terminal compatibility
          TERM: 'xterm-256color',
          // Fix Windows Unicode encoding issues
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      attachOutputForwarder(this.engineProcess, { logPrefix: "GTN-ENGINE" })

      // Handle stdout with line buffering and carriage return handling
      this.engineProcess.stdout?.on('data', (data) => {
        this.stdoutBuffer += data.toString('utf8');

        // Handle both Windows CRLF and Unix LF line endings
        // First normalize Windows line endings
        this.stdoutBuffer = this.stdoutBuffer.replace(/\r\n/g, '\n');

        // Handle carriage returns (\r) which are used for progress indicators
        // Split by \r to handle overwrites, keeping only the last one
        const carriageReturnParts = this.stdoutBuffer.split('\r');
        if (carriageReturnParts.length > 1) {
          // Keep only the last part after \r (this is what should be displayed)
          this.stdoutBuffer = carriageReturnParts[carriageReturnParts.length - 1];
        }

        const lines = this.stdoutBuffer.split('\n');

        // Keep the last incomplete line in the buffer
        this.stdoutBuffer = lines.pop() || '';

        // Process complete lines
        lines.forEach(line => {
          if (line.trim().length > 0) {
            this.addLog('stdout', line);
          }
        });
      });

      // Handle stderr with line buffering and carriage return handling
      this.engineProcess.stderr?.on('data', (data) => {
        this.stderrBuffer += data.toString('utf8');

        // Handle both Windows CRLF and Unix LF line endings
        // First normalize Windows line endings
        this.stderrBuffer = this.stderrBuffer.replace(/\r\n/g, '\n');

        // Handle carriage returns (\r) which are used for progress indicators
        // Split by \r to handle overwrites, keeping only the last one
        const carriageReturnParts = this.stderrBuffer.split('\r');
        if (carriageReturnParts.length > 1) {
          // Keep only the last part after \r (this is what should be displayed)
          this.stderrBuffer = carriageReturnParts[carriageReturnParts.length - 1];
        }

        const lines = this.stderrBuffer.split('\n');

        // Keep the last incomplete line in the buffer
        this.stderrBuffer = lines.pop() || '';

        // Process complete lines
        lines.forEach(line => {
          if (line.trim().length > 0) {
            this.addLog('stderr', line);
          }
        });
      });

      // Handle process exit
      this.engineProcess.on('exit', (code, signal) => {
        // Flush any remaining buffered data
        if (this.stdoutBuffer.trim().length > 0) {
          this.addLog('stdout', this.stdoutBuffer);
          this.stdoutBuffer = '';
        }
        if (this.stderrBuffer.trim().length > 0) {
          this.addLog('stderr', this.stderrBuffer);
          this.stderrBuffer = '';
        }

        if (code !== 0) {
          this.addLog('stderr', `Engine process failed with exit code ${code} and signal ${signal}`);
        } else {
          this.addLog('stdout', `Engine process exited normally with code ${code}`);
        }

        // Clean up the process and its listeners
        const processToClean = this.engineProcess;
        if (processToClean) {
          processToClean.removeAllListeners();
          processToClean.stdout?.removeAllListeners();
          processToClean.stderr?.removeAllListeners();
        }

        this.engineProcess = null;
        this.checkStatus();

        // Auto-restart if it crashed unexpectedly
        if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          this.addLog('stdout', `Attempting to restart engine (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);
          setTimeout(() => this.start(), this.restartDelay);
        } else if (this.restartAttempts >= this.maxRestartAttempts) {
          this.addLog('stderr', 'Maximum restart attempts reached. Engine will not auto-restart.');
          this.status = 'error';
          this.emit('status-changed', this.status);
        }
      });

      // Handle process error
      this.engineProcess.on('error', (error) => {
        this.addLog('stderr', `Engine process error: ${error.message}`);
        this.addLog('stderr', `Error code: ${(error as any).code}, errno: ${(error as any).errno}`);
        this.status = 'error';
        this.emit('status-changed', this.status);
      });

      // Update status
      this.status = 'running';
      this.emit('status-changed', this.status);
      this.restartAttempts = 0; // Reset restart attempts on successful start

    } catch (error) {
      this.addLog('stderr', `Failed to start engine: ${error.message}`);
      this.status = 'error';
      this.emit('status-changed', this.status);
      throw error;
    }
  }

  /**
   * Stop the engine
   */
  async stop(): Promise<void> {
    if (!this.engineProcess || this.engineProcess.killed) {
      console.log('Engine is not running');
      return;
    }

    this.addLog('stdout', 'Stopping Griptape Nodes engine...');

    // Clear buffers when stopping
    this.stdoutBuffer = '';
    this.stderrBuffer = '';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.addLog('stderr', 'Engine stop timeout, forcing kill...');
        this.engineProcess?.kill('SIGKILL');
        resolve();
      }, 10000);

      this.engineProcess?.once('exit', () => {
        clearTimeout(timeout);
        // Remove all listeners from the process to prevent memory leaks
        this.engineProcess?.removeAllListeners();
        this.engineProcess?.stdout?.removeAllListeners();
        this.engineProcess?.stderr?.removeAllListeners();
        this.engineProcess = null;
        this.checkStatus();
        resolve();
      });

      // Try graceful shutdown first
      this.engineProcess?.kill('SIGTERM');
    });
  }

  /**
   * Restart the engine
   */
  async restart(): Promise<void> {
    this.addLog('stdout', 'Restarting Griptape Nodes engine...');
    await this.stop();
    await this.start();
  }

  /**
   * Initialize the service and start engine if possible
   */
  async initialize(): Promise<void> {
    console.log('[ENGINE] Initialize called');
    // Re-check status to see if conditions have changed
    this.checkStatus();

    // Auto-start the engine if it's ready
    if (this.status === 'ready') {
      console.log('[ENGINE] Status is ready, attempting to start...');
      try {
        await this.start();
      } catch (error) {
        console.error('[ENGINE] Failed to auto-start engine:', error);
      }
    } else {
      console.log(`[ENGINE] Not ready to start. Status: ${this.status}`);
      // Emit status change to notify UI of current state
      this.emit('status-changed', this.status);
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  async destroy(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}
