import { spawn } from 'child_process';
import { attachOutputForwarder } from '../../utils/child-process/output-forwarder';
import { getEnv } from '../config/env';

export async function installGtn(uvExecutable: string, userDataDir: string): Promise<void> {
  const installProcess = spawn(uvExecutable, ['tool', 'install', '--quiet', 'griptape-nodes'], {
    env: getEnv(userDataDir),
    shell: true,
  });
  await attachOutputForwarder(installProcess, {
    logPrefix: 'INSTALL_GTN'
  });
}

