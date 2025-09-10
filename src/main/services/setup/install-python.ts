import * as fs from 'fs';
import { spawn } from 'child_process';
import { attachOutputForwarder } from '../../utils/child-process/output-forwarder';
import { getEnv } from '../config/env';
import { getPythonVersion } from '../config/versions';
import { getUvExecutablePath } from '../config/paths';


export async function installPython(userDataDir: string): Promise<void> {
  const uvExecutablePath = getUvExecutablePath(userDataDir);
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`);
  }

  const uvProcess = spawn(uvExecutablePath, ['python', 'install', getPythonVersion()], {
    env: getEnv(userDataDir),
  });
  await attachOutputForwarder(uvProcess, {
    logPrefix: 'INSTALL_PYTHON'
  });
}
