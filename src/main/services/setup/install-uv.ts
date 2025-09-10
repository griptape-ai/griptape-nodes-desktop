import { exec } from 'child_process';
import { attachOutputForwarder } from '../../utils/child-process/output-forwarder';
import { getUvInstallDir } from '../config/paths';

export async function installUv(userDataDir: string): Promise<void> {

  const platform = process.platform;
  const arch = process.arch;
  // const uvProcess = spawn(uvExecutable, ['python', 'install', getPythonVersion()], {
  //   env: getEnv(userDataDir),
  // });
  // await attachOutputForwarder(uvProcess, {
  //   logPrefix: 'INSTALL_PYTHON'
  // });

  const uvInstallDir = getUvInstallDir(userDataDir);

  const command = (platform === 'win32')
  ? `powershell -ExecutionPolicy ByPass -c {$env:UV_INSTALL_DIR = "${uvInstallDir}";irm https://astral.sh/uv/install.ps1 | iex}`
  : `curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL="${uvInstallDir}" UV_NO_MODIFY_PATH=1 sh`;

  const child = exec(command);
  await attachOutputForwarder(child, { logPrefix: 'INSTALL-UV' });
}
