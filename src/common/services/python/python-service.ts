import { ChildProcess, spawn } from 'child_process'
import { collectStdout } from '../../child-process/collect-stdout'
import { attachOutputForwarder } from '../../child-process/output-forwarder'
import { getEnv } from '../../config/env'
import { getCwd } from '../../config/paths'
import { logger } from '@/main/utils/logger'
import EventEmitter from 'events'
import { UvService } from '../uv/uv-service'
import { findPythonExecutablePath, installPython } from './install-python'

interface PythonServiceEvents {
  ready: []
}

export class PythonService extends EventEmitter<PythonServiceEvents> {
  private isReady: boolean = false
  private pythonExecutablePath?: string

  constructor(
    private userDataDir: string,
    private uvService: UvService
  ) {
    super()
  }

  async start(): Promise<void> {
    logger.info('python service start')
    this.uvService.waitForReady()

    await this.installPython()
    this.isReady = true
    this.emit('ready')
    logger.info('python service ready')
  }

  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.once('ready', resolve))
  }

  async installPython(): Promise<void> {
    logger.info('python service installPython start')
    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    await installPython(this.userDataDir, uvExecutablePath)
    this.pythonExecutablePath = await findPythonExecutablePath(this.userDataDir, uvExecutablePath)
    logger.info('python service installPython end')
  }

  async getPythonExecutablePath(): Promise<string> {
    await this.waitForReady()
    if (!this.pythonExecutablePath) {
      throw new Error('Expected pythonExecutablePath to be ready')
    }
    return this.pythonExecutablePath
  }

  private async spawnPython(command: string): Promise<ChildProcess> {
    const pythonExecutablePath = await this.getPythonExecutablePath()
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)
    const child = spawn(pythonExecutablePath, ['-c', command], { cwd, env })
    attachOutputForwarder(child, { logPrefix: `python ${command}` })
    return child
  }

  async getPythonVersion(): Promise<string> {
    const child = await this.spawnPython('import sys; print(sys.version)')
    const stdout = await collectStdout(child)
    return stdout.trim()
  }

  async getInstalledPackages(): Promise<string[]> {
    try {
      const child = await this.spawnPython(
        'import subprocess; import json; result = subprocess.run(["pip", "list", "--format=json"], capture_output=True, text=True); print(result.stdout)'
      )
      const stdout = await collectStdout(child)
      const packages = JSON.parse(stdout.trim())
      return packages.map((pkg: { name: string; version: string }) => `${pkg.name}==${pkg.version}`)
    } catch (error) {
      logger.error('Failed to get installed packages:', error)
      return []
    }
  }
}
