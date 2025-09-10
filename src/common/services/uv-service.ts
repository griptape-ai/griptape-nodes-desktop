import { spawn } from 'child_process';
import { getUvExecutablePath } from '../config/paths';
import { getEnv } from '../config/env';
import { attachOutputForwarder } from '../child-process/output-forwarder';
import { collectStdout } from '../child-process/collect-stdout';

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
    const child = spawn(executablePath, args, { env });
    attachOutputForwarder(child, { logPrefix: `uv ${args.join(' ')}` });
    return collectStdout(child);
  }
}
