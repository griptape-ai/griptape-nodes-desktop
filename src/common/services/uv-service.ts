import { spawn } from 'child_process';
import { collectStdout } from '../child-process/collect-stdout';
import { attachOutputForwarder } from '../child-process/output-forwarder';
import { getEnv } from '../config/env';
import { getCwd, getUvExecutablePath } from '../config/paths';

export class UvService {
  private userDataDir: string;

  constructor(userDataDir: string) {
    this.userDataDir = userDataDir;
  }

  async getUvVersion(): Promise<string> {
    return await this.runUv(["--version"]);
  }

  private async runUv(args: string[]) {
    const executablePath = getUvExecutablePath(this.userDataDir);
    const env = getEnv(this.userDataDir);
    const cwd = getCwd(this.userDataDir);
    const child = spawn(executablePath, args, { cwd, env });
    attachOutputForwarder(child, { logPrefix: `uv ${args.join(' ')}` });
    return collectStdout(child);
  }
}
