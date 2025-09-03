import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { PythonService } from '../python';
import { GriptapeNodesService } from '../griptape-nodes';
import { getPythonInstallDir, getUvToolDir } from '../downloader';
import * as path from 'path';
import * as fs from 'fs';

export type EngineStatus = 'not-ready' | 'ready' | 'running' | 'error';

export interface EngineLog {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
}

export class EngineService extends EventEmitter {
  private pythonService: PythonService;
  private gtnService: GriptapeNodesService;
  private engineProcess: ChildProcess | null = null;
  private status: EngineStatus = 'not-ready';
  private logs: EngineLog[] = [];
  private maxLogSize = 1000; // Keep last 1000 log entries
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private restartDelay = 5000; // 5 seconds
  private stdoutBuffer = ''; // Buffer for incomplete stdout lines
  private stderrBuffer = ''; // Buffer for incomplete stderr lines

  constructor(pythonService: PythonService, gtnService: GriptapeNodesService) {
    super();
    this.pythonService = pythonService;
    this.gtnService = gtnService;
    this.checkStatus();
  }

  /**
   * Get current engine status
   */
  getStatus(): EngineStatus {
    return this.status;
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
  private checkStatus(): void {
    const oldStatus = this.status;

    if (!this.pythonService.isGriptapeNodesReady()) {
      this.status = 'not-ready';
      this.addLog('stderr', 'Griptape Nodes is not installed');
    } else if (!this.isInitialized()) {
      this.status = 'not-ready';
      this.addLog('stderr', 'Griptape Nodes not initialized. Run "gtn init" first.');
    } else if (this.engineProcess && !this.engineProcess.killed) {
      this.status = 'running';
    } else {
      this.status = 'ready';
    }

    if (oldStatus !== this.status) {
      this.emit('status-changed', this.status);
    }
  }

  /**
   * Add a log entry
   */
  private addLog(type: 'stdout' | 'stderr', message: string): void {
    const log: EngineLog = {
      timestamp: new Date(),
      type,
      message
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
      const gtnPath = this.pythonService.getGriptapeNodesPath();
      if (!gtnPath) {
        throw new Error('Griptape Nodes executable not found');
      }

      // Clear logs from previous session when starting fresh
      this.logs = [];
      this.addLog('stdout', 'Starting Griptape Nodes engine...');

      // Spawn the engine process from config directory so it finds the config file
      this.engineProcess = spawn(gtnPath, ['engine'], {
        cwd: this.gtnService.getConfigDirectory(),
        env: {
          ...process.env,
          UV_PYTHON_INSTALL_DIR: getPythonInstallDir(),
          UV_TOOL_DIR: getUvToolDir()
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stdout with line buffering
      this.engineProcess.stdout?.on('data', (data) => {
        this.stdoutBuffer += data.toString();
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

      // Handle stderr with line buffering
      this.engineProcess.stderr?.on('data', (data) => {
        this.stderrBuffer += data.toString();
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
        
        this.addLog('stderr', `Engine process exited with code ${code} and signal ${signal}`);
        
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
    this.checkStatus();
    
    // Auto-start the engine if it's ready
    if (this.status === 'ready') {
      try {
        await this.start();
      } catch (error) {
        console.error('Failed to auto-start engine:', error);
      }
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