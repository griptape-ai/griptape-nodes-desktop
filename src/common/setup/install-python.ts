import { spawn } from 'child_process';
import * as fs from 'fs';
import { attachOutputForwarder } from '../../common/child-process/output-forwarder';
import { getEnv } from '../../common/config/env';
import { getCwd, getUvExecutablePath } from '../../common/config/paths';
import { getPythonVersion } from '../../common/config/versions';


export async function installPython(userDataDir: string): Promise<void> {
  const uvExecutablePath = getUvExecutablePath(userDataDir);
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`);
  }

  const uvProcess = spawn(uvExecutablePath, ['python', 'install', getPythonVersion()], {
    cwd: getCwd(userDataDir),
    env: getEnv(userDataDir),
  });
  await attachOutputForwarder(uvProcess, {
    logPrefix: 'INSTALL_PYTHON'
  });
}
