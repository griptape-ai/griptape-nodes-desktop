import { spawn } from 'child_process'
import * as fs from 'fs'
import { attachOutputForwarder } from '../../common/child-process/output-forwarder'
import { getEnv } from '../../common/config/env'
import { getCwd, getUvExecutablePath } from '../../common/config/paths'

export async function installGtn(userDataDir: string): Promise<void> {
  const uvExecutablePath = getUvExecutablePath(userDataDir)
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`)
  }

  const installProcess = spawn(uvExecutablePath, ['tool', 'install', '--quiet', 'griptape-nodes'], {
    cwd: getCwd(userDataDir),
    env: getEnv(userDataDir),
  })
  await attachOutputForwarder(installProcess, {
    logPrefix: 'INSTALL_GTN',
  })
}
