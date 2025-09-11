import { spawn } from 'child_process';
import * as fs from 'fs';
import { collectStdout } from '../../common/child-process/collect-stdout';
import { attachOutputForwarder } from '../../common/child-process/output-forwarder';
import { getEnv } from '../../common/config/env';
import { getPythonVersion } from '../../common/config/versions';
import { getCwd } from '../../common/config/paths';


export async function installPython(userDataDir: string, uvExecutablePath: string): Promise<void> {
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`);
  }

  const child = spawn(uvExecutablePath, ['python', 'install', getPythonVersion()], {
    env: getEnv(userDataDir),
    cwd: getCwd(userDataDir),
  });
  await attachOutputForwarder(child, {
    logPrefix: 'INSTALL_PYTHON'
  });
}

export async function findPythonExecutablePath(userDataDir: string, uvExecutablePath: string): Promise<string> {
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`);
  }
  const child = spawn(uvExecutablePath, ['python', 'find', getPythonVersion()], {
    env: getEnv(userDataDir),
    cwd: getCwd(userDataDir),
  });
  attachOutputForwarder(child, {
    logPrefix: 'FIND_PYTHON'
  });
  return collectStdout(child);
}