import { spawn } from 'child_process';
import { collectStdout } from '../../child-process/collect-stdout';
import { attachOutputForwarder } from '../../child-process/output-forwarder';
import { getEnv } from '../../config/env';
import { getCwd, getUvExecutablePath } from '../../config/paths';
import EventEmitter from 'events';
import { installUv } from './install-uv';
import * as fs from 'fs';
import { logger } from '@/logger';



interface UvServiceEvents {
  'ready': [];
}

export class UvService extends EventEmitter<UvServiceEvents> {
  private userDataDir: string;
  private isReady: boolean = false;
  private uvExecutablePath?: string;
  private uvVersion?: string;

  constructor(userDataDir: string) {
    super();
    this.userDataDir = userDataDir;
  }

  async start(): Promise<void> {
    logger.info("uv service start");
    await this.installUv();
    this.isReady = true;
    this.emit('ready');
    logger.info("uv service ready");
  }

  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve();
    }
    return new Promise(resolve => this.once('ready', resolve));
  }

  async installUv(): Promise<void> {
    logger.info('uv service installUv start');
    const uvExecutablePath = getUvExecutablePath(this.userDataDir);
    if (!fs.existsSync(uvExecutablePath)) {
      await installUv(this.userDataDir);
    }
    this.uvExecutablePath = uvExecutablePath;
    logger.info('uv service installUv end');
  }

  async getUvVersion(): Promise<string> {
    await this.waitForReady();
    if (!this.uvVersion) {
      this.uvVersion = await this.runUv(["--version"]);
    }
    return this.uvVersion;
  }

  async getUvExecutablePath(): Promise<string> {
    await this.waitForReady();
    return getUvExecutablePath(this.userDataDir);
  }

  private async runUv(args: string[]) {
    await this.waitForReady();

    const executablePath = getUvExecutablePath(this.userDataDir);
    const env = getEnv(this.userDataDir);
    const cwd = getCwd(this.userDataDir);
    const child = spawn(executablePath, args, { cwd, env });
    attachOutputForwarder(child, { logPrefix: `uv ${args.join(' ')}` });
    return collectStdout(child);
  }
}
