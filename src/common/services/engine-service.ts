import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { attachOutputForwarder } from '../child-process/output-forwarder';
import { getEnv } from '../config/env';
import { getCwd, getGtnExecutablePath } from '../config/paths';
import { GtnService } from './gtn-service';
import { PythonService } from './python-service';
import { logger } from '@/logger';

export type EngineStatus = 'not-ready' | 'ready' | 'initializing' | 'running' | 'error';

export interface EngineLog {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
}

interface Events {
  'engine:status-changed': [EngineStatus];
  'engine:log': [EngineLog]
  'engine:logs-cleared': [];
}

export class EngineService extends EventEmitter<Events> {
  private engineProcess: ChildProcess | null = null;
  private status: EngineStatus = 'not-ready';
  private logs: EngineLog[] = [];
  private maxLogSize = 1000; // Keep last 1000 log entries
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private restartDelay = 5000; // 5 seconds
  private stdoutBuffer = ''; // Buffer for incomplete stdout lines
  private stderrBuffer = ''; // Buffer for incomplete stderr lines

  constructor(
    private userDataDir: string,
    private gtnService: GtnService,
  ) {
    super();
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
    this.emit('engine:status-changed', this.status);
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
    this.emit('engine:logs-cleared');
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
      // .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
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

    this.emit('engine:log', log);
  }

  /**
   * Start the engine
   */
  async start(): Promise<void> {
    // HACK! Lazily getting the executable path this way SUCKS!
    const gtnPath = this.gtnService.getGtnExecutablePath();
    if (!this.gtnService.gtnExecutableExists()) {
      this.setStatus('initializing');
      return;
    }

    this.setStatus('running');

    try {
      // Clear logs from previous session when starting fresh
      this.logs = [];
      this.addLog('stdout', 'Starting Griptape Nodes engine...');
      logger.info('[ENGINE] Starting Griptape Nodes engine...');
      logger.info(`[ENGINE] Command: ${gtnPath} engine`);

      // Spawn the engine process from config directory so it finds the config file
      this.engineProcess = spawn(
        gtnPath,
        [
          '--no-update',
          'engine',
        ],
        {
        cwd: getCwd(this.userDataDir),
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
      this.engineProcess.once('exit', (code, signal) => {
        // Flush any remaining buffered data
        if (this.stdoutBuffer.trim().length > 0) {
          this.addLog('stdout', this.stdoutBuffer);
          this.stdoutBuffer = '';
        }
        if (this.stderrBuffer.trim().length > 0) {
          this.addLog('stderr', this.stderrBuffer);
          this.stderrBuffer = '';
        }

        // Clean up the process and its listeners
        this.engineProcess?.removeAllListeners();
        this.engineProcess?.stdout?.removeAllListeners();
        this.engineProcess?.stderr?.removeAllListeners();
        this.engineProcess = null;

        // Auto-restart if it crashed unexpectedly
        if (this.status == 'ready') {
          // This means someone "stopped" the engine.
          this.restartAttempts = 0;
          this.addLog('stdout', 'Engine stopped.');
        } else if (this.status == 'running' && code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          this.addLog('stdout', `Engine process exited unexpected with exit code: ${code}`);
          this.addLog('stdout', `Attempting to restart engine (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);
          setTimeout(() => this.start(), this.restartDelay);
          this.setStatus('ready');
        } else {
          this.addLog('stderr', 'Maximum restart attempts reached. Engine will not auto-restart.');
          this.setStatus('error');
        }
      });

      // Handle process error
      this.engineProcess.on('error', (error) => {
        this.addLog('stderr', `Engine process error: ${error.message}`);
        this.addLog('stderr', `Error code: ${(error as any).code}, errno: ${(error as any).errno}`);
        this.setStatus('error');
      });

    } catch (error) {
      this.addLog('stderr', `Failed to start engine: ${error.message}`);
      this.setStatus('error');
    }
  }

  private setStatus(status: EngineStatus) {
    if (status == this.status) {
      return;
    }
    this.status = status;
    this.emit('engine:status-changed', status);
  }

  /**
   * Stop the engine
   */
  async stop(): Promise<void> {
    if (this.status == 'running') {
      // Set status to ready so that the exit handler doesn't try to restart.
      this.setStatus('ready');
    }
    // Try kill first.
    if (this.engineProcess) {
      // Let process exit event handle the clean up.
      this.engineProcess.kill('SIGKILL');
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    // Try sigterm after graceperiod.
    if (this.engineProcess) {
      // Let process exit event handle the clean up.
      this.engineProcess.kill('SIGTERM');
    }
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
    logger.info('[ENGINE] Initialize called');

    // Auto-start the engine if it's ready
    if (this.status === 'ready') {
      logger.info('[ENGINE] Status is ready, attempting to start...');
      try {
        await this.start();
      } catch (error) {
        logger.error('[ENGINE] Failed to auto-start engine:', error);
      }
    } else {
      logger.info(`[ENGINE] Not ready to start. Status: ${this.status}`);
      // Emit status change to notify UI of current state
      this.emit('engine:status-changed', this.status);
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
