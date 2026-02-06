import { spawn } from 'child_process'
import { collectStdout } from '../../child-process/collect-stdout'
import { attachOutputForwarder } from '../../child-process/output-forwarder'
import { getEnv } from '../../config/env'
import { getCwd, getUvExecutablePath } from '../../config/paths'
import EventEmitter from 'events'
import { installUv } from './install-uv'
import * as fs from 'fs'
import { logger } from '@/main/utils/logger'

interface UvServiceEvents {
  ready: []
}

export class UvService extends EventEmitter<UvServiceEvents> {
  private userDataDir: string
  private isReady: boolean = false
  private uvExecutablePath?: string
  private uvVersion?: string

  constructor(userDataDir: string) {
    super()
    this.userDataDir = userDataDir
  }

  async start(): Promise<void> {
    logger.info('UvService: Starting')
    await this.installUv()
    this.isReady = true
    this.emit('ready')
    logger.info('UvService: Ready')
  }

  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.once('ready', resolve))
  }

  async installUv(): Promise<void> {
    logger.info('UvService: Installing UV')
    const uvExecutablePath = getUvExecutablePath(this.userDataDir)
    if (!fs.existsSync(uvExecutablePath)) {
      await installUv(this.userDataDir)
    }
    this.uvExecutablePath = uvExecutablePath
    logger.info('UvService: UV installed')
  }

  async reinstall(): Promise<void> {
    logger.info('UvService: Reinstalling')
    this.isReady = false

    // Remove UV directory
    const uvDir = this.userDataDir + '/uv'
    if (fs.existsSync(uvDir)) {
      logger.info('UvService: Removing UV directory')
      fs.rmSync(uvDir, { recursive: true, force: true })
    }

    // Reinstall UV
    await installUv(this.userDataDir)
    this.uvExecutablePath = getUvExecutablePath(this.userDataDir)

    this.isReady = true
    this.emit('ready')
    logger.info('UvService: Reinstall complete')
  }

  async getUvVersion(): Promise<string> {
    await this.waitForReady()
    if (!this.uvVersion) {
      this.uvVersion = await this.runUv(['--version'])
    }
    return this.uvVersion
  }

  async getUvExecutablePath(): Promise<string> {
    await this.waitForReady()
    return getUvExecutablePath(this.userDataDir)
  }

  private async runUv(args: string[]) {
    await this.waitForReady()

    const executablePath = getUvExecutablePath(this.userDataDir)
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)
    const child = spawn(executablePath, args, { cwd, env })
    attachOutputForwarder(child, { logPrefix: `uv ${args.join(' ')}` })
    return collectStdout(child)
  }
}
