import * as fs from 'fs';
import { spawn } from 'child_process';
import { attachOutputForwarder } from '../common/child-process/output-forwarder';
import { getEnv } from '../common/config/env';

export async function installGtn(userDataDir: string, uvExecutablePath: string): Promise<void> {
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`);
  }

  const installProcess = spawn(uvExecutablePath, ['tool', 'install', '--quiet', 'griptape-nodes'], {
    env: getEnv(userDataDir),
  });
  await attachOutputForwarder(installProcess, {
    logPrefix: 'INSTALL_GTN'
  });
}
