import { ChildProcess, spawn } from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { readdir } from 'fs/promises'
import { collectStdout } from '../../child-process/collect-stdout'
import { attachOutputForwarder } from '../../child-process/output-forwarder'
import { getEnv } from '../../config/env'
import {
  getCwd,
  getEnginesJsonPath,
  getGtnConfigPath,
  getGtnExecutablePath,
  getXdgDataHome
} from '../../config/paths'
import { logger } from '@/main/utils/logger'
import { UvService } from '../uv/uv-service'
import EventEmitter from 'events'
import { installGtn } from './install-gtn'
import { PythonService } from '../python/python-service'
import { HttpAuthService } from '../auth/http'
import { OnboardingService } from '../onboarding-service'
import { SettingsService } from '../settings-service'
import Store from 'electron-store'

async function findFiles(dir: string, target: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results = await Promise.all(
    entries.map(async (e): Promise<string[] | string> => {
      const fullPath = path.join(dir, e.name)
      if (e.isDirectory()) return findFiles(fullPath, target)
      if (e.isFile() && e.name === target) return path.resolve(fullPath)
      return []
    })
  )
  return results.flat()
}

export function mergeNestedArray<T>({
  obj,
  path,
  items,
  unique
}: {
  obj: Record<string, any>
  path: string[]
  items: T[]
  unique: boolean
}): void {
  const parent = path
    .slice(0, -1)
    .reduce<any>(
      (a, k) => (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? a[k] : (a[k] = {})),
      obj
    )
  const key = path[path.length - 1],
    cur = parent[key],
    base: T[] = cur === undefined ? [] : Array.isArray(cur) ? cur : [cur]
  parent[key] = unique ? Array.from(new Set<T>([...base, ...items])) : [...base, ...items]
}

interface GtnServiceEvents {
  ready: []
  'workspace-changed': [string]
}

export class GtnService extends EventEmitter<GtnServiceEvents> {
  private isReady: boolean = false
  private gtnExecutablePath?: string
  private store: any
  private engineService?: any // Reference to EngineService for forwarding logs

  constructor(
    private userDataDir: string,
    private defaultWorkspaceDir: string,
    private uvService: UvService,
    private pythonService: PythonService,
    private authService: HttpAuthService,
    private onboardingService: OnboardingService,
    private settingsService: SettingsService
  ) {
    super()
    this.store = new Store({
      name: 'gtn-workspace'
    })

    // Listen for store changes
    this.store.onDidAnyChange((newValue: any, oldValue: any) => {
      if (
        newValue?.workspaceDirectory !== oldValue?.workspaceDirectory &&
        newValue?.workspaceDirectory
      ) {
        this.emit('workspace-changed', newValue.workspaceDirectory)
      }
    })
  }

  /**
   * Set the engine service reference for forwarding initialization logs
   */
  setEngineService(engineService: any): void {
    this.engineService = engineService
  }

  async start() {
    logger.info('gtn service start')
    await this.uvService.waitForReady()
    await this.pythonService.waitForReady()

    // Check if GTN already exists before installation
    const gtnAlreadyExists = this.gtnExecutableExists()

    try {
      await this.installGtn()
    } catch (error) {
      logger.error('GTN installation failed:', error)
      if (this.engineService) {
        this.engineService.addLog(
          'stderr',
          `GTN installation failed: ${error instanceof Error ? error.message : String(error)}`
        )
        this.engineService.setError()
      }
      throw error
    }

    // Run self-update if GTN already exists
    if (gtnAlreadyExists) {
      try {
        logger.info('GTN already installed, checking for updates...')
        if (this.engineService) {
          this.engineService.addLog('stdout', 'Checking for GTN updates...')
        }
        await this.selfUpdate()
        if (this.engineService) {
          this.engineService.addLog('stdout', 'GTN update check completed')
        }
      } catch (error) {
        // Non-fatal: log error but continue startup
        logger.error('GTN self-update failed, continuing with existing version:', error)
        if (this.engineService) {
          this.engineService.addLog(
            'stderr',
            `GTN update failed: ${error}. Continuing with existing version.`
          )
        }
      }
    }

    await this.syncLibraries()
    await this.registerLibraries()

    try {
      // Wait for both API key and workspace setup before initializing
      await this.onboardingService.waitForWorkspaceSetup()
      await this.initialize({
        apiKey: await this.authService.waitForApiKey(),
        workspaceDirectory: this.workspaceDirectory || this.defaultWorkspaceDir,
        storageBackend: 'local',
        advancedLibrary: this.onboardingService.isAdvancedLibraryEnabled(),
        cloudLibrary: this.onboardingService.isCloudLibraryEnabled()
      })
    } catch (error) {
      logger.error('GTN initialization failed:', error)
      if (this.engineService) {
        this.engineService.addLog(
          'stderr',
          `GTN initialization failed: ${error instanceof Error ? error.message : String(error)}`
        )
        this.engineService.setError()
      }
      throw error
    }

    this.isReady = true
    this.emit('ready')
    logger.info('gtn service ready')
  }

  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.once('ready', resolve))
  }

  async installGtn() {
    logger.info('gtn service installGtn start')
    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    const channel = this.settingsService.getEngineChannel()
    await installGtn(this.userDataDir, uvExecutablePath, channel)
    this.gtnExecutablePath = getGtnExecutablePath(this.userDataDir)
    logger.info('gtn service installGtn end')
  }

  async getGtnExecutablePath(): Promise<string> {
    await this.waitForReady()
    if (!this.gtnExecutablePath) {
      throw new Error('Expected gtnExecutablePath to be ready')
    }
    return this.gtnExecutablePath
  }

  async selfUpdate(): Promise<void> {
    logger.info('Running gtn self update')

    // Execute gtn self update and forward logs to engine service if available
    const child = await this.runGtn(['self', 'update'], { wait: false })

    // Forward logs to engine service for UI display
    if (this.engineService) {
      child.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.engineService.addLog('stdout', line)
          }
        })
      })

      child.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.engineService.addLog('stderr', line)
          }
        })
      })
    }

    // Wait for the process to complete
    await new Promise<void>((resolve, reject) => {
      child.on('exit', (code) => {
        if (code === 0) {
          logger.info('gtn self update completed successfully')
          resolve()
        } else {
          const error = new Error(`gtn self update failed with exit code ${code}`)
          logger.error('gtn self update failed:', error)
          reject(error)
        }
      })
      child.on('error', (error) => {
        logger.error('gtn self update error:', error)
        reject(error)
      })
    })
  }

  async initialize(options: {
    apiKey?: string
    workspaceDirectory?: string
    storageBackend?: 'local' | 'gtc'
    bucketName?: string
    advancedLibrary?: boolean
    cloudLibrary?: boolean
  }): Promise<void> {
    // Write engines.json with friendly engine name before running gtn init
    const enginesJsonPath = getEnginesJsonPath(this.userDataDir)
    const hostname = os.hostname()
    const engineName = `Griptape Nodes Desktop - ${hostname}`

    // Generate UUID for engine ID (using crypto.randomUUID() for Node 14.17+)
    const engineId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    const enginesJson = {
      engines: [
        {
          id: engineId,
          name: engineName,
          created_at: timestamp
        }
      ],
      default_engine_id: engineId
    }

    fs.mkdirSync(path.dirname(enginesJsonPath), { recursive: true })
    fs.writeFileSync(enginesJsonPath, JSON.stringify(enginesJson, null, 2), 'utf8')
    logger.info(`Created engines.json with engine name: ${engineName}`)

    const args = ['init', '--no-interactive']

    if (options.apiKey) {
      args.push('--api-key', options.apiKey)
    }

    if (options.workspaceDirectory) {
      args.push('--workspace-directory', options.workspaceDirectory)
    }

    if (options.storageBackend) {
      args.push('--storage-backend', options.storageBackend)
    }

    if (options.storageBackend === 'gtc' && options.bucketName) {
      args.push('--bucket-name', options.bucketName)
    }

    // Add library flags based on user preferences
    if (options.advancedLibrary !== undefined) {
      args.push(
        options.advancedLibrary ? '--register-advanced-library' : '--no-register-advanced-library'
      )
    }

    if (options.cloudLibrary !== undefined) {
      args.push(
        options.cloudLibrary
          ? '--register-griptape-cloud-library'
          : '--no-register-griptape-cloud-library'
      )
    }

    // Log the command without exposing the API key
    const sanitizedArgs = [...args]
    const apiKeyIndex = sanitizedArgs.indexOf('--api-key')
    if (apiKeyIndex !== -1 && apiKeyIndex + 1 < sanitizedArgs.length) {
      sanitizedArgs[apiKeyIndex + 1] = '[REDACTED]'
    }
    logger.info('Running gtn init with args:', sanitizedArgs.join(' '))

    // Execute gtn init and forward logs to engine service if available
    const child = await this.runGtn(args, { wait: false })

    // Forward logs to engine service for UI display
    if (this.engineService) {
      child.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.engineService.addLog('stdout', line)
          }
        })
      })

      child.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n')
        lines.forEach((line: string) => {
          if (line.trim()) {
            this.engineService.addLog('stderr', line)
          }
        })
      })
    }

    // Wait for the process to complete
    await new Promise<void>((resolve, reject) => {
      child.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`gtn init failed with exit code ${code}`))
        }
      })
      child.on('error', reject)
    })
  }

  get workspaceDirectory(): string {
    return this.store.get('workspaceDirectory')
  }

  set workspaceDirectory(directory: string) {
    this.store.set('workspaceDirectory', directory)
  }

  async updateWorkspaceDirectory(workspaceDirectory: string): Promise<void> {
    await this.waitForReady()
    await this.initialize({ workspaceDirectory })
    await this.refreshConfig()
  }

  async findLibraryConfigPaths() {
    const dir = getXdgDataHome(this.userDataDir)
    if (!fs.existsSync(dir)) {
      return []
    }
    let libraryPaths = await findFiles(dir, 'griptape_nodes_library.json')
    // Just return all of the libraries we find. If you wanted to exclude somthing,
    // then you can filter it out of this list. Long term, we should have "real"
    // library management.
    return libraryPaths
  }

  /**
   * Sync libraries with current engine version
   */
  async syncLibraries() {
    let libraryPaths = await this.findLibraryConfigPaths()
    if (libraryPaths.length > 0) {
      // Skip sync if already installed.
      // Ideally we'd force retry installation if a library
      // is FLAWED or UNUSABLE. But that's for later.
      logger.info(`GtnService: SKIPPING SYNC, libraryPaths: "${libraryPaths}"`)
      return
    }

    await this.runGtn(['libraries', 'sync'], { wait: true })
  }

  async registerLibraries() {
    let libraryPaths = await this.findLibraryConfigPaths()
    const gtnConfigPath = getGtnConfigPath(this.userDataDir)
    const data = fs.existsSync(gtnConfigPath) ? fs.readFileSync(gtnConfigPath, 'utf8') : '{}'
    const json = JSON.parse(data)
    mergeNestedArray({
      obj: json,
      path: ['app_events', 'on_app_initialization_complete', 'libraries_to_register'],
      items: libraryPaths,
      unique: true
    })
    fs.mkdirSync(path.dirname(gtnConfigPath), { recursive: true })
    fs.writeFileSync(gtnConfigPath, JSON.stringify(json, null, 2), 'utf8')
  }

  async refreshConfig() {
    await this.waitForReady()
    const child = await this.runGtn(['config', 'show'])
    const json = await collectStdout(child)
    const config = JSON.parse(json)
    this.workspaceDirectory = config?.workspace_directory
  }

  async updateApiKey(apiKey: string) {
    await this.waitForReady()
    const gtnConfigPath = getGtnConfigPath(this.userDataDir)

    if (!fs.existsSync(gtnConfigPath)) {
      logger.warn('GTN config file does not exist, cannot update API key')
      return
    }

    try {
      const data = fs.readFileSync(gtnConfigPath, 'utf8')
      const config = JSON.parse(data)

      // Update the API key in the config
      if (!config.gt_cloud) {
        config.gt_cloud = {}
      }
      config.gt_cloud.api_key = apiKey

      // Write the updated config back
      fs.writeFileSync(gtnConfigPath, JSON.stringify(config, null, 2), 'utf8')
      logger.info('Updated API key in GTN config')
    } catch (error) {
      logger.error('Failed to update API key in GTN config:', error)
    }
  }

  async runGtn(
    args: string[] = [],
    options?: { forward_logs?: boolean; wait?: boolean }
  ): Promise<ChildProcess> {
    const wait = options?.wait || false
    const forward_logs = options?.forward_logs || false

    // Hack to ensure executable is available by the time login is complete
    // and the UI tries to use it.
    while (!this.gtnExecutablePath) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)
    const child = spawn(this.gtnExecutablePath, ['--no-update', ...args], { env, cwd })
    if (forward_logs) {
      attachOutputForwarder(child, { logPrefix: `gtn ${args.join(' ')}`.slice(0, 10) })
    }
    if (wait) {
      // We don't actually care about the output here. We just
      // want it to finish. Ideally we'd have another util like
      // this that doesn't waste time and space buffering the
      // output.
      await collectStdout(child)
    }
    return child
  }

  async getGtnVersion(): Promise<string> {
    const child = await this.runGtn(['self', 'version'])
    return await collectStdout(child)
  }

  async upgradeGtn(): Promise<void> {
    logger.info('gtn service upgradeGtn start')
    await this.waitForReady()

    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)
    const channel = this.settingsService.getEngineChannel()

    if (channel === 'nightly') {
      // For nightly, we need to reinstall from GitHub to get the latest
      logger.info('Upgrading nightly channel - reinstalling from GitHub')
      await installGtn(this.userDataDir, uvExecutablePath, 'nightly')
    } else {
      // For stable, use uv tool upgrade
      logger.info('Running uv tool upgrade griptape-nodes')
      const upgradeProcess = spawn(uvExecutablePath, ['tool', 'upgrade', 'griptape-nodes'], {
        env,
        cwd
      })

      attachOutputForwarder(upgradeProcess, { logPrefix: 'UPGRADE_GTN' })

      // Wait for upgrade to complete
      await new Promise<void>((resolve, reject) => {
        upgradeProcess.on('exit', (code) => {
          if (code === 0) {
            logger.info('gtn service upgradeGtn completed successfully')
            resolve()
          } else {
            const error = new Error(`GTN upgrade failed with exit code ${code}`)
            logger.error('gtn service upgradeGtn failed:', error)
            reject(error)
          }
        })
        upgradeProcess.on('error', (error) => {
          logger.error('gtn service upgradeGtn error:', error)
          reject(error)
        })
      })
    }
  }

  async switchChannel(channel: 'stable' | 'nightly'): Promise<void> {
    logger.info(`Switching engine channel to: ${channel}`)
    await this.waitForReady()

    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)

    // Uninstall current version
    logger.info('Uninstalling current GTN version')
    const uninstallProcess = spawn(uvExecutablePath, ['tool', 'uninstall', 'griptape-nodes'], {
      env,
      cwd
    })

    await new Promise<void>((resolve, _reject) => {
      uninstallProcess.on('exit', (code) => {
        if (code === 0) {
          logger.info('Successfully uninstalled GTN')
          resolve()
        } else {
          logger.warn(`Uninstall returned exit code ${code}, continuing with install`)
          resolve() // Continue even if uninstall fails
        }
      })
      uninstallProcess.on('error', (error) => {
        logger.warn('Uninstall error, continuing with install:', error)
        resolve() // Continue even if uninstall fails
      })
    })

    // Install new channel version
    logger.info(`Installing GTN from ${channel} channel`)
    await installGtn(this.userDataDir, uvExecutablePath, channel)

    // Refresh cached executable path after reinstallation
    this.gtnExecutablePath = getGtnExecutablePath(this.userDataDir)
    logger.info(`Successfully switched to ${channel} channel`)
  }

  async forceReinstallGtn(): Promise<void> {
    logger.info('Force reinstalling GTN')

    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)
    const channel = this.settingsService.getEngineChannel()

    // Attempt to uninstall current version
    logger.info('Uninstalling current GTN version (if exists)')
    const uninstallProcess = spawn(uvExecutablePath, ['tool', 'uninstall', 'griptape-nodes'], {
      env,
      cwd
    })

    await new Promise<void>((resolve) => {
      uninstallProcess.on('exit', (code) => {
        if (code === 0) {
          logger.info('Successfully uninstalled GTN')
        } else {
          logger.warn(`Uninstall returned exit code ${code}, continuing with install`)
        }
        resolve()
      })
      uninstallProcess.on('error', (error) => {
        logger.warn('Uninstall error, continuing with install:', error)
        resolve()
      })
    })

    // Clear the UV tool environment directory if it exists and is corrupted
    const gtnToolPath = path.join(this.userDataDir, 'uv-tools', 'griptape-nodes')
    if (fs.existsSync(gtnToolPath)) {
      try {
        logger.info('Removing corrupted GTN tool directory')
        fs.rmSync(gtnToolPath, { recursive: true, force: true })
        logger.info('Successfully removed corrupted GTN tool directory')
      } catch (error) {
        logger.warn('Failed to remove GTN tool directory, continuing with install:', error)
      }
    }

    // Reinstall with force flags
    logger.info(`Reinstalling GTN from ${channel} channel`)
    await installGtn(this.userDataDir, uvExecutablePath, channel)

    // Refresh cached executable path
    this.gtnExecutablePath = getGtnExecutablePath(this.userDataDir)
    logger.info('Successfully force reinstalled GTN')
  }

  gtnExecutableExists(): boolean {
    return !!this.gtnExecutablePath && fs.existsSync(this.gtnExecutablePath)
  }

  async reinstall(): Promise<void> {
    logger.info('gtn service reinstall start')
    this.isReady = false

    // Use forceReinstallGtn to reinstall GTN
    await this.forceReinstallGtn()

    // Run initialize to configure GTN with user settings
    try {
      await this.initialize({
        apiKey: await this.authService.waitForApiKey(),
        workspaceDirectory: this.workspaceDirectory || this.defaultWorkspaceDir,
        storageBackend: 'local',
        advancedLibrary: this.onboardingService.isAdvancedLibraryEnabled(),
        cloudLibrary: this.onboardingService.isCloudLibraryEnabled()
      })
    } catch (error) {
      logger.error('GTN initialization failed during reinstall:', error)
      if (this.engineService) {
        this.engineService.addLog(
          'stderr',
          `GTN initialization failed: ${error instanceof Error ? error.message : String(error)}`
        )
        this.engineService.setError()
      }
      throw error
    }

    this.isReady = true
    this.emit('ready')
    logger.info('gtn service reinstall end')
  }
}
