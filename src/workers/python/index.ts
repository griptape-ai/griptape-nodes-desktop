import { spawn } from 'child_process';
import * as path from 'path';
import { parentPort } from 'worker_threads';

interface WorkerMessage {
  type: 'execute';
  command: string;
  args?: string[];
  executablePath: string;
  env?: NodeJS.ProcessEnv;
}

interface WorkerResponse {
  type: 'stream' | 'error' | 'complete';
  data?: string;
  stream?: 'stdout' | 'stderr';
  error?: string;
}

// Character streaming configuration
const CHAR_DELAY_MS = 5; // Delay between character chunks
const CHUNK_SIZE = 3; // Number of characters to emit at once

class OutputStreamer {
  private buffer = '';
  private streaming = false;
  private streamType: 'stdout' | 'stderr';

  constructor(streamType: 'stdout' | 'stderr') {
    this.streamType = streamType;
  }

  async streamData(data: string) {
    this.buffer += data;
    if (!this.streaming) {
      this.streaming = true;
      await this.processBuffer();
    }
  }

  private async processBuffer() {
    while (this.buffer.length > 0) {
      const chunk = this.buffer.slice(0, CHUNK_SIZE);
      this.buffer = this.buffer.slice(CHUNK_SIZE);
      
      parentPort?.postMessage({
        type: 'stream',
        data: chunk,
        stream: this.streamType
      } as WorkerResponse);

      // Small delay for typewriter effect
      await new Promise(resolve => setTimeout(resolve, CHAR_DELAY_MS));
    }
    this.streaming = false;
  }

  flush() {
    // Send any remaining buffered data immediately
    if (this.buffer.length > 0) {
      parentPort?.postMessage({
        type: 'stream',
        data: this.buffer,
        stream: this.streamType
      } as WorkerResponse);
      this.buffer = '';
    }
  }
}

parentPort?.on('message', async (message: WorkerMessage) => {
  if (message.type === 'execute') {
    const { command, args = [], executablePath, env } = message;
    
    try {
      const childProcess = spawn(executablePath, ['-c', command, ...args], {
        env: env || process.env,
        shell: false
      });

      const stdoutStreamer = new OutputStreamer('stdout');
      const stderrStreamer = new OutputStreamer('stderr');

      // Handle stdout
      childProcess.stdout?.on('data', async (data: Buffer) => {
        await stdoutStreamer.streamData(data.toString());
      });

      // Handle stderr
      childProcess.stderr?.on('data', async (data: Buffer) => {
        await stderrStreamer.streamData(data.toString());
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        // Flush any remaining data
        stdoutStreamer.flush();
        stderrStreamer.flush();
        
        parentPort?.postMessage({
          type: 'complete',
          data: `Process exited with code ${code}`
        } as WorkerResponse);
      });

      // Handle errors
      childProcess.on('error', (error) => {
        parentPort?.postMessage({
          type: 'error',
          error: error.message
        } as WorkerResponse);
      });

    } catch (error: any) {
      parentPort?.postMessage({
        type: 'error',
        error: error.message
      } as WorkerResponse);
    }
  }
});