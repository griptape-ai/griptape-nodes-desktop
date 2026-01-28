import { ChildProcess, exec, spawn } from 'child_process'
import { attachOutputForwarder } from '../../child-process/output-forwarder'
import { getUvInstallDir } from '../../config/paths'
import { getCwd } from '../../config/paths'
import { getEnv } from '../../config/env'

export async function installUv(userDataDir: string): Promise<void> {
  const uvInstallDir = getUvInstallDir(userDataDir)
  const child =
    process.platform === 'win32'
      ? spawnWindows(userDataDir, uvInstallDir)
      : spawnUnix(userDataDir, uvInstallDir)
  await attachOutputForwarder(child, { logPrefix: 'INSTALL-UV' })
}

function spawnWindows(userDataDir: string, uvInstallDir: string): ChildProcess {
  return spawn(
    'powershell.exe',
    [
      '-ExecutionPolicy',
      'ByPass',
      '-c',
      `$env:UV_UNMANAGED_INSTALL = "${uvInstallDir}";irm https://astral.sh/uv/install.ps1 | iex`,
    ],
    {
      // Important! We must not use the default value of `process.env`. If we do,
      // then we may indavertently inherit incorrect powershell module paths from
      // a parent process. For example if we are in development mode and run `npm start`
      // from powershell 7, but the default installed version of powershell.exe is 5,
      // then we will get a bunch of errors relating to import failures of core powershell
      // modules.
      env: {},
      cwd: getCwd(userDataDir),
    },
  )
}

function spawnUnix(userDataDir: string, uvInstallDir: string): ChildProcess {
  return exec(
    `curl -LsSf https://astral.sh/uv/install.sh | env UV_UNMANAGED_INSTALL="${uvInstallDir}" sh`,
    {
      env: {
        ...getEnv(userDataDir),
        PATH: '/usr/bin:/bin', // A minimal path that should work on unix.
      },
      cwd: getCwd(userDataDir),
    },
  )
}
