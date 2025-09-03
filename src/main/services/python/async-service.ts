import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import { PythonService } from './index';
import { getPythonInstallDir } from '../downloader';

export interface StreamEvent {
  type: 'stream' | 'error' | 'complete';
  data?: string;
  stream?: 'stdout' | 'stderr';
  error?: string;
}

export class AsyncPythonService extends EventEmitter {
  private pythonService: PythonService;
  private worker: Worker | null = null;

  constructor() {
    super();
    this.pythonService = new PythonService();
  }

  /**
   * Initialize the worker thread
   */
  private initWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(path.join(__dirname, 'python-worker.js'));
      
      this.worker.on('error', (error) => {
        console.error('Python worker error:', error);
        this.emit('error', error);
      });

      this.worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Python worker stopped with exit code ${code}`);
        }
        this.worker = null;
      });
    }
    return this.worker;
  }

  /**
   * Execute Python command with streaming output
   */
  async executePythonStream(command: string, sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonPath = this.pythonService.getPythonExecutablePath();
      
      if (!pythonPath) {
        this.emit(`stream-${sessionId}`, {
          type: 'error',
          error: 'Python executable not found'
        });
        reject(new Error('Python executable not found'));
        return;
      }

      const worker = this.initWorker();

      // Set up message handler for this session
      const messageHandler = (message: StreamEvent) => {
        // Emit events with session ID for specific listeners
        this.emit(`stream-${sessionId}`, message);

        if (message.type === 'complete' || message.type === 'error') {
          worker.off('message', messageHandler);
          if (message.type === 'error') {
            reject(new Error(message.error));
          } else {
            resolve();
          }
        }
      };

      worker.on('message', messageHandler);

      // Send execution command to worker
      worker.postMessage({
        type: 'execute',
        command,
        executablePath: pythonPath,
        env: {
          ...process.env,
          UV_PYTHON_INSTALL_DIR: getPythonInstallDir()
        }
      });
    });
  }

  /**
   * Get Python info with streaming output
   */
  async getPythonInfoStream(sessionId: string): Promise<void> {
    const commands = [
      { cmd: 'import sys; print(f"Python {sys.version}")', label: 'version' },
      { cmd: 'import sys; print(f"Executable: {sys.executable}")', label: 'path' },
      { cmd: 'import sys; print("\\n".join(sys.path))', label: 'syspath' }
    ];

    for (const { cmd, label } of commands) {
      this.emit(`stream-${sessionId}`, {
        type: 'stream',
        data: `\n--- ${label.toUpperCase()} ---\n`,
        stream: 'stdout'
      });
      
      try {
        await this.executePythonStream(cmd, sessionId);
      } catch (error) {
        console.error(`Failed to execute ${label} command:`, error);
      }
    }

    // Also get griptape-nodes info
    const griptapeNodesPath = this.pythonService.getGriptapeNodesPath();
    if (griptapeNodesPath) {
      this.emit(`stream-${sessionId}`, {
        type: 'stream',
        data: `\n--- GRIPTAPE NODES ---\n`,
        stream: 'stdout'
      });
      
      this.emit(`stream-${sessionId}`, {
        type: 'stream',
        data: `Path: ${griptapeNodesPath}\n`,
        stream: 'stdout'
      });
      
      const version = this.pythonService.getGriptapeNodesVersion();
      this.emit(`stream-${sessionId}`, {
        type: 'stream',
        data: `Version: ${version}\n`,
        stream: 'stdout'
      });
    }

    this.emit(`stream-${sessionId}`, {
      type: 'complete',
      data: 'Python info retrieval complete'
    });
  }

  /**
   * Get synchronous Python info (fallback)
   */
  getPythonInfo() {
    return this.pythonService.getPythonInfo();
  }

  /**
   * Check if Python service is ready
   */
  isReady(): boolean {
    return this.pythonService.isReady();
  }

  /**
   * Clean up worker thread
   */
  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}