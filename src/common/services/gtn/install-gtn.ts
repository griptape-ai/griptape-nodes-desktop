import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { attachOutputForwarder } from '../../child-process/output-forwarder'
import { getEnv } from '../../config/env'
import { getCwd } from '../../config/paths'
import { logger } from '@/main/utils/logger'

/**
 * Check if the UV tool environment for griptape-nodes is corrupted
 */
function isGtnEnvironmentCorrupted(userDataDir: string): boolean {
  const gtnToolPath = path.join(userDataDir, 'uv-tools', 'griptape-nodes')

  // If the tool directory doesn't exist, it's not corrupted - just not installed
  if (!fs.existsSync(gtnToolPath)) {
    return false
  }

  // Check if the Python executable exists in the expected location
  const pythonPath = path.join(gtnToolPath, 'bin', 'python3')
  if (!fs.existsSync(pythonPath)) {
    logger.warn(`GTN environment corrupted: missing Python executable at ${pythonPath}`)
    return true
  }

  return false
}

/**
 * Uninstall griptape-nodes to recover from corrupted environment
 */
async function uninstallGtn(userDataDir: string, uvExecutablePath: string): Promise<void> {
  logger.info('Attempting to uninstall corrupted GTN environment')

  const uninstallProcess = spawn(uvExecutablePath, ['tool', 'uninstall', 'griptape-nodes'], {
    env: getEnv(userDataDir),
    cwd: getCwd(userDataDir),
  })

  try {
    await attachOutputForwarder(uninstallProcess, {
      logPrefix: 'UNINSTALL_GTN',
    })
    logger.info('Successfully uninstalled corrupted GTN environment')
  } catch (error) {
    // Uninstall might fail if the environment is too corrupted, which is fine
    // The install process should still work
    logger.warn('Uninstall failed, but continuing with install:', error)
  }
}

export async function installGtn(
  userDataDir: string,
  uvExecutablePath: string,
  channel: 'stable' | 'nightly' = 'stable',
  engineService?: any,
): Promise<void> {
  if (!fs.existsSync(uvExecutablePath)) {
    throw new Error(`UV executable not found at: ${uvExecutablePath}`)
  }

  // Check for corrupted environment and attempt recovery
  if (isGtnEnvironmentCorrupted(userDataDir)) {
    logger.info('Detected corrupted GTN environment, attempting recovery')
    await uninstallGtn(userDataDir, uvExecutablePath)
  }

  // Build install command based on channel
  let installArgs: string[]
  if (channel === 'nightly') {
    installArgs = [
      'tool',
      'install',
      'git+https://github.com/griptape-ai/griptape-nodes.git@latest',
      '--reinstall',
      '--force',
      '--python',
      '3.12',
    ]
    logger.info('Installing GTN from nightly channel (GitHub latest)')
  } else {
    installArgs = ['tool', 'install', '--quiet', 'griptape-nodes']
    logger.info('Installing GTN from stable channel (PyPI)')
  }

  const installProcess = spawn(uvExecutablePath, installArgs, {
    env: getEnv(userDataDir),
    cwd: getCwd(userDataDir),
  })

  // Forward logs to engine service if available
  if (engineService) {
    installProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach((line: string) => {
        if (line.trim()) {
          engineService.addLog('stdout', line)
        }
      })
    })

    installProcess.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n')
      lines.forEach((line: string) => {
        if (line.trim()) {
          engineService.addLog('stderr', line)
        }
      })
    })
  }

  await attachOutputForwarder(installProcess, {
    logPrefix: 'INSTALL_GTN',
  })
}
