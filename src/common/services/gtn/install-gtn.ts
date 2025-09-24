import { spawn } from 'child_process';
import * as fs from 'fs';
import { attachOutputForwarder } from '../../child-process/output-forwarder';
import { getEnv } from '../../config/env';
import { getCwd } from '../../config/paths';

export async function installGtn(userDataDir: string, uvExecutablePath: string): Promise<void> {
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`);
  }

  const installProcess = spawn(uvExecutablePath, ['tool', 'install', '--quiet', 'griptape-nodes'], {
    env: getEnv(userDataDir),
    cwd: getCwd(userDataDir),
  });
  await attachOutputForwarder(installProcess, {
    logPrefix: 'INSTALL_GTN'
  });
}
