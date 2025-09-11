import { ChildProcess, spawn } from 'child_process';
import { collectStdout } from '../child-process/collect-stdout';
import { attachOutputForwarder } from '../child-process/output-forwarder';
import { getEnv } from '../config/env';
import { getCwd } from '../config/paths';

export class PythonService {
  constructor(
    private userDataDir: string,
    private pythonExecutablePath: string,
  ) {}

  /**
   * Get the path to the bundled Python executable
   */
  getPythonExecutablePath(): string {
    throw new Error("Not yet implemented");
  }

  private spawnPython(command: string): ChildProcess {
    const env = getEnv(this.userDataDir);
    const cwd = getCwd(this.userDataDir);
    const child = spawn(this.pythonExecutablePath, ['-c', command], { cwd, env });
    attachOutputForwarder(child, { logPrefix: `python ${command}` });
    return child;
  }

  async getPythonVersion(): Promise<string> {
    const child = this.spawnPython('import sys; print(sys.version)');
    const stdout = await collectStdout(child);
    return stdout.trim();
  }
}
