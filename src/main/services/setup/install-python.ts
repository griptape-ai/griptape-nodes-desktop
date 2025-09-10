import { spawn } from 'child_process';
import { attachOutputForwarder } from '../../utils/child-process/output-forwarder';
import { getEnv } from '../config/env';
import { getPythonVersion } from '../config/versions';


export async function installPython(uvExecutable: string, userDataDir: string): Promise<void> {
  const uvProcess = spawn(uvExecutable, ['python', 'install', getPythonVersion()], {
    env: getEnv(userDataDir),
  });
  await attachOutputForwarder(uvProcess, {
    logPrefix: 'INSTALL_PYTHON'
  });
}
