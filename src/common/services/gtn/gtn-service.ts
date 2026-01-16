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
import { FakeEngineUpdateManager } from '../update/fake-update-manager'
import { getErrorMessage } from '../../utils/error'
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

interface GtnWorkspaceSchema {
  workspaceDirectory: string
}

/**
 * Interface for the EngineService methods used by GtnService.
 * This avoids circular dependency since EngineService imports GtnService.
 */
interface EngineServiceRef {
  addLog(type: 'stdout' | 'stderr', message: string): void
  setError(): void
}

export class GtnService extends EventEmitter<GtnServiceEvents> {
  private isReady: boolean = false
  private gtnExecutablePath?: string
  private store: any
  private engineService?: EngineServiceRef

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
  setEngineService(engineService: EngineServiceRef): void {
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
        this.engineService.addLog('stderr', `GTN installation failed: ${getErrorMessage(error)}`)
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

    // Check if GTN has already been initialized
    const gtnConfigPath = getGtnConfigPath(this.userDataDir)
    const isAlreadyInitialized = fs.existsSync(gtnConfigPath)

    if (isAlreadyInitialized) {
      logger.info('GTN already initialized, skipping init')
      if (this.engineService) {
        this.engineService.addLog('stdout', 'GTN already initialized')
      }
      // Ensure engines.json exists even if GTN was already initialized
      // This fixes the regression where engine names lost hostname after the init-skip change
      this.ensureEnginesJson()
    } else {
      try {
        logger.info('Initializing GTN...')
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
            `GTN initialization failed: ${getErrorMessage(error)}`
          )
          this.engineService.setError()
        }
        throw error
      }
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
    await installGtn(this.userDataDir, uvExecutablePath, channel, this.engineService)
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
    logger.info('Running uv tool upgrade griptape-nodes')

    // Get UV executable and environment configuration
    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)

    // Spawn UV tool upgrade process
    const child = spawn(uvExecutablePath, ['tool', 'upgrade', 'griptape-nodes'], { env, cwd })

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
          logger.info('uv tool upgrade griptape-nodes completed successfully')
          resolve()
        } else {
          const error = new Error(`uv tool upgrade failed with exit code ${code}`)
          logger.error('uv tool upgrade failed:', error)
          reject(error)
        }
      })
      child.on('error', (error) => {
        logger.error('uv tool upgrade error:', error)
        reject(error)
      })
    })
  }

  /**
   * Ensures engines.json exists with the engine name including hostname.
   * This is called both during initialization and for existing installations
   * to fix the regression where engine names lost hostname information.
   */
  private ensureEnginesJson(): void {
    const enginesJsonPath = getEnginesJsonPath(this.userDataDir)

    // Only create if it doesn't exist to preserve existing engine IDs
    if (fs.existsSync(enginesJsonPath)) {
      logger.info('engines.json already exists, preserving existing configuration')
      return
    }

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
  }

  async initialize(options: {
    apiKey?: string
    workspaceDirectory?: string
    storageBackend?: 'local' | 'gtc'
    bucketName?: string
    advancedLibrary?: boolean
    cloudLibrary?: boolean
  }): Promise<void> {
    // Ensure engines.json exists with friendly engine name before running gtn init
    this.ensureEnginesJson()

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
    const sanitizedCommand = `gtn ${sanitizedArgs.join(' ')}`
    logger.info('Running gtn init with args:', sanitizedCommand)

    // Forward init command to engine service for UI display
    if (this.engineService) {
      this.engineService.addLog('stdout', `Running: ${sanitizedCommand}`)
    }

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
    const forward_logs = options?.forward_logs || true

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

  /**
   * Check for available engine updates by running `gtn self version` without --no-update flag.
   * This command checks PyPI/GitHub for the latest version and prompts if an update is available.
   *
   * In development mode, if FAKE_ENGINE_UPDATE_AVAILABLE=true is set, uses FakeEngineUpdateManager.
   *
   * @returns Object with currentVersion, latestVersion, and updateAvailable flag
   */
  async checkForEngineUpdate(): Promise<{
    currentVersion: string
    latestVersion: string | null
    updateAvailable: boolean
  }> {
    // Use fake engine update manager if enabled (for dev testing)
    if (FakeEngineUpdateManager.isEnabled()) {
      const fakeManager = new FakeEngineUpdateManager()
      return fakeManager.checkForUpdate()
    }

    logger.info('Checking for engine updates...')

    // Wait for GTN to be available
    while (!this.gtnExecutablePath) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)

    // Run gtn self version WITHOUT --no-update flag to allow update check
    const child = spawn(this.gtnExecutablePath, ['self', 'version'], { env, cwd })

    // Pattern to match update prompt
    // Example: "Your current engine version, v0.60.0, is behind the latest release, v0.66.2."
    const updatePattern =
      /Your current engine version, v([\d.]+), is behind the latest release, v([\d.]+)/

    // Pattern to extract version from final output line
    // Matches both: "v0.60.0 (pypi)" and "v0.60.0 (git - e172e80)"
    const versionPattern = /v([\d.]+)\s+\((pypi|git\s*-\s*[a-f0-9]+)\)/i

    let currentVersion = ''
    let latestVersion: string | null = null
    let updateAvailable = false
    let outputBuffer = ''

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // If process hasn't completed after 30s, kill it and return what we have
        logger.warn('Engine update check timed out')
        child.kill()
        resolve({
          currentVersion: currentVersion || 'unknown',
          latestVersion,
          updateAvailable
        })
      }, 30000)

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        outputBuffer += text
        logger.debug('gtn self version stdout:', text)

        // Check for update prompt
        const updateMatch = outputBuffer.match(updatePattern)
        if (updateMatch) {
          currentVersion = updateMatch[1]
          latestVersion = updateMatch[2]
          updateAvailable = true
          logger.info(
            `Engine update available: current v${currentVersion}, latest v${latestVersion}`
          )

          // Send "n" to stdin to decline the update and let the command complete
          if (child.stdin && !child.stdin.destroyed) {
            child.stdin.write('n\n')
          }
        }

        // Check for version output (final line)
        const versionMatch = text.match(versionPattern)
        if (versionMatch && !currentVersion) {
          currentVersion = versionMatch[1]
        }
      })

      child.stderr?.on('data', (data: Buffer) => {
        logger.debug('gtn self version stderr:', data.toString())
      })

      child.on('exit', (code) => {
        clearTimeout(timeout)

        if (code !== 0 && code !== null) {
          logger.warn(`gtn self version exited with code ${code}`)
        }

        // If we didn't find the current version in the update prompt, try to parse it from output
        if (!currentVersion) {
          const versionMatch = outputBuffer.match(versionPattern)
          if (versionMatch) {
            currentVersion = versionMatch[1]
          }
        }

        logger.info(
          `Engine update check complete: current=${currentVersion}, latest=${latestVersion}, updateAvailable=${updateAvailable}`
        )

        resolve({
          currentVersion: currentVersion || 'unknown',
          latestVersion,
          updateAvailable
        })
      })

      child.on('error', (error) => {
        clearTimeout(timeout)
        logger.error('Engine update check failed:', error)
        reject(error)
      })
    })
  }

  async upgradeGtn(): Promise<void> {
    logger.info('gtn service upgradeGtn start')
    await this.waitForReady()

    const channel = this.settingsService.getEngineChannel()

    if (channel === 'nightly') {
      // For nightly, we need to reinstall from GitHub to get the latest
      logger.info('Upgrading nightly channel - reinstalling from GitHub')
      const uvExecutablePath = await this.uvService.getUvExecutablePath()
      await installGtn(this.userDataDir, uvExecutablePath, 'nightly')
    } else {
      // For stable, use gtn self update
      logger.info('Running gtn self update')
      await this.selfUpdate()
    }
  }

  async switchChannel(channel: 'stable' | 'nightly'): Promise<void> {
    logger.info(`Switching engine channel to: ${channel}`)
    await this.waitForReady()

    if (this.engineService) {
      this.engineService.addLog('stdout', `Starting channel switch to ${channel}...`)
    }

    const uvExecutablePath = await this.uvService.getUvExecutablePath()
    const env = getEnv(this.userDataDir)
    const cwd = getCwd(this.userDataDir)

    // Uninstall current version
    logger.info('Uninstalling current GTN version')
    if (this.engineService) {
      this.engineService.addLog('stdout', 'Uninstalling current GTN version...')
    }
    const uninstallProcess = spawn(uvExecutablePath, ['tool', 'uninstall', 'griptape-nodes'], {
      env,
      cwd
    })

    await new Promise<void>((resolve, _reject) => {
      uninstallProcess.on('exit', (code) => {
        if (code === 0) {
          logger.info('Successfully uninstalled GTN')
          if (this.engineService) {
            this.engineService.addLog('stdout', 'Successfully uninstalled previous GTN version')
          }
          resolve()
        } else {
          logger.warn(`Uninstall returned exit code ${code}, continuing with install`)
          if (this.engineService) {
            this.engineService.addLog(
              'stdout',
              'Previous version uninstalled with warnings, continuing...'
            )
          }
          resolve() // Continue even if uninstall fails
        }
      })
      uninstallProcess.on('error', (error) => {
        logger.warn('Uninstall error, continuing with install:', error)
        if (this.engineService) {
          this.engineService.addLog(
            'stdout',
            'Previous version not found or already uninstalled, proceeding...'
          )
        }
        resolve() // Continue even if uninstall fails
      })
    })

    // Install new channel version
    logger.info(`Installing GTN from ${channel} channel`)
    if (this.engineService) {
      this.engineService.addLog('stdout', `Installing GTN from ${channel} channel...`)
    }
    await installGtn(this.userDataDir, uvExecutablePath, channel)

    // Refresh cached executable path after reinstallation
    this.gtnExecutablePath = getGtnExecutablePath(this.userDataDir)
    logger.info(`Successfully switched to ${channel} channel`)
    if (this.engineService) {
      this.engineService.addLog('stdout', `Successfully switched to ${channel} channel`)
    }
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
        this.engineService.addLog('stderr', `GTN initialization failed: ${getErrorMessage(error)}`)
        this.engineService.setError()
      }
      throw error
    }

    this.isReady = true
    this.emit('ready')
    logger.info('gtn service reinstall end')
  }
}
