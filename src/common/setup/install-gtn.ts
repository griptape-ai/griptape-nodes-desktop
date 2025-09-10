import * as fs from 'fs';
import { spawn } from 'child_process';
import { attachOutputForwarder } from '../main/utils/child-process/output-forwarder';
import { getEnv } from '../main/services/config/env';
import { getUvExecutablePath } from '../main/services/config/paths';

export async function installGtn(userDataDir: string): Promise<void> {
  const uvExecutablePath = getUvExecutablePath(userDataDir);
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
