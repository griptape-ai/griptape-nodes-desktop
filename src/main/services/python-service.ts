import * as fs from 'fs';
import { spawn } from 'child_process';
import { getUvExecutablePath } from './config/paths';
import { getEnv } from './config/env';
import { attachOutputForwarder } from '../utils/child-process/output-forwarder';
import { collectStdout } from '../utils/child-process/collect-stdout';

export class PythonService {
  private userDataDir: string;

  constructor(userDataDir: string) {
    this.userDataDir = userDataDir;
  }

  private async runUv(args: string[]) {
    const gtnExecutablePath = getUvExecutablePath(this.userDataDir);
    const env = getEnv(this.userDataDir);
    const child = spawn(gtnExecutablePath, args, { env });
    await attachOutputForwarder(child, { logPrefix: `uv ${args.join(' ')}` });
  }

  /**
   * Get the path to the bundled Python executable
   */
  getPythonExecutablePath(): string {
    throw new Error("Not yet implemented");

    // getPythonInstallDir()
    // try {
    //   // Use the same UV_PYTHON_INSTALL_DIR as during download to ensure consistency
    //   const env = {
    //     ...process.env,
    //     UV_PYTHON_INSTALL_DIR: getPythonInstallDir(this.userDataDir),
    //     UV_MANAGED_PYTHON: '1'
    //   };

    //   const result = execSync(`"${this.uvExecutablePath}" python find ${getPythonVersion()}`, {
    //     encoding: 'utf8',
    //     stdio: ['pipe', 'pipe', 'pipe'],
    //     env
    //   });
    //   return result.trim();
    // } catch (error) {
    //   console.error('Failed to find Python executable:', error);
    //   return null;
    // }
  }

  private async runPython(command: string): Promise<string> {
    const gtnExecutablePath = this.getPythonExecutablePath();
    const env = getEnv(this.userDataDir);
    const child = spawn(gtnExecutablePath, ['-c', command], { env });
    attachOutputForwarder(child, { logPrefix: `python ${command}` });
    return await collectStdout(child);
  }

  /**
   * Get Python version and executable path info
   */
  async getPythonInfo(): Promise<{ executable: string; version: string; }> {
    return {
      executable: this.getPythonExecutablePath(),
      version: (await this.runPython('import sys; print(sys.version)')).trim(),
    };
  }

  /**
   * Check if Python exists
   */
  isReady(): boolean {
    return fs.existsSync(this.getPythonExecutablePath());
  }
  
}
