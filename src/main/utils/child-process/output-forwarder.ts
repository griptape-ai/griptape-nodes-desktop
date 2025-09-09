import { ChildProcess } from 'child_process';

export interface OutputForwarderOptions {
  logPrefix: string;
  errorPrefix?: string;
}

export function attachOutputForwarder(
  process: ChildProcess,
  options: OutputForwarderOptions
): Promise<void> {
  const { logPrefix, errorPrefix = `${logPrefix}_STDERR` } = options;

  return new Promise<void>((resolve, reject) => {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    process.stdout?.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      lines.forEach(line => {
        if (line.trim()) console.log(`[${logPrefix}] ${line}`);
      });
    });

    process.stderr?.on('data', (data) => {
      stderrBuffer += data.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop() || '';
      lines.forEach(line => {
        if (line.trim()) console.error(`[${errorPrefix}] ${line}`);
      });
    });

    process.on('close', (code) => {
      // Print any remaining buffered content
      
      // stdout
      let lines = stdoutBuffer.split('\n');
      stdoutBuffer = '';
      lines.forEach(line => {
        if (line.trim()) console.log(`[${logPrefix}] ${line}`);
      });

      // stderr  
      lines = stderrBuffer.split('\n');
      stderrBuffer = '';
      lines.forEach(line => {
        if (line.trim()) console.error(`[${errorPrefix}] ${line}`);
      });

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process failed with exit code ${code}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}