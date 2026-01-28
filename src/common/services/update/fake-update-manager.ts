import { logger } from '@/main/utils/logger'
import type { UpdateManager, UpdateInfo } from 'velopack'
import type { VelopackAsset } from 'velopack/lib/bindings/VelopackAsset'
import type { UpdateBehavior } from '@/types/global'

/**
 * Configuration options for FakeUpdateManager (App Updates).
 * These can be set via environment variables or passed directly.
 *
 * App Update Environment Variables:
 * - FAKE_UPDATE_AVAILABLE: 'true' or 'false' - whether an update is available (default: 'true')
 * - FAKE_UPDATE_VERSION: string - the version to report as available (default: '99.0.0-fake')
 * - FAKE_UPDATE_CURRENT_VERSION: string - the current version to report (default: '0.0.0-dev')
 * - FAKE_UPDATE_DOWNLOAD_TIME_MS: number - how long the download simulation takes in ms (default: 2000)
 * - FAKE_UPDATE_FAIL_CHECK: 'true' or 'false' - simulate check failure (default: 'false')
 * - FAKE_UPDATE_FAIL_DOWNLOAD: 'true' or 'false' - simulate download failure (default: 'false')
 * - FAKE_UPDATE_PACKAGE_ID: string - the package ID to report (default: 'griptape-nodes-desktop')
 * - FAKE_UPDATE_BEHAVIOR: 'auto-update' | 'prompt' | 'silence' - override app update behavior setting (default: uses settings)
 *
 * Engine Update Environment Variables:
 * - FAKE_ENGINE_UPDATE_AVAILABLE: 'true' or 'false' - whether an engine update is available (default: 'false')
 * - FAKE_ENGINE_CURRENT_VERSION: string - the current engine version to report (default: '0.1.0')
 * - FAKE_ENGINE_LATEST_VERSION: string - the latest engine version to report (default: '99.0.0')
 * - FAKE_ENGINE_UPDATE_TIME_MS: number - how long the update simulation takes in ms (default: 3000)
 * - FAKE_ENGINE_UPDATE_FAIL: 'true' or 'false' - simulate update failure (default: 'false')
 * - FAKE_ENGINE_UPDATE_BEHAVIOR: 'auto-update' | 'prompt' | 'silence' - override engine update behavior setting (default: uses settings)
 */
export interface FakeUpdateConfig {
  /** Whether an update is available */
  updateAvailable?: boolean
  /** The version to report as available */
  targetVersion?: string
  /** The current version to report */
  currentVersion?: string
  /** How long the download simulation takes in ms */
  downloadTimeMs?: number
  /** Simulate a check failure */
  failCheck?: boolean
  /** Simulate a download failure */
  failDownload?: boolean
  /** The package ID to report */
  packageId?: string
}

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return value.toLowerCase() === 'true'
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Fake update manager for development mode that implements the UpdateManager interface.
 * Cannot extend UpdateManager directly because its constructor requires packaged app binaries.
 *
 * Configuration can be provided via:
 * 1. Constructor config object
 * 2. Environment variables (prefixed with FAKE_UPDATE_)
 *
 * Constructor config takes precedence over environment variables.
 */
export class FakeUpdateManager implements Pick<
  UpdateManager,
  | 'getCurrentVersion'
  | 'getAppId'
  | 'isPortable'
  | 'getUpdatePendingRestart'
  | 'checkForUpdatesAsync'
  | 'downloadUpdateAsync'
  | 'waitExitThenApplyUpdate'
> {
  private config: Required<FakeUpdateConfig>
  private downloadedUpdate: UpdateInfo | null = null

  constructor(config?: FakeUpdateConfig) {
    this.config = {
      updateAvailable: config?.updateAvailable ?? getEnvBool('FAKE_UPDATE_AVAILABLE', true),
      targetVersion: config?.targetVersion ?? process.env.FAKE_UPDATE_VERSION ?? '99.0.0-fake',
      currentVersion:
        config?.currentVersion ?? process.env.FAKE_UPDATE_CURRENT_VERSION ?? '0.0.0-dev',
      downloadTimeMs: config?.downloadTimeMs ?? getEnvNumber('FAKE_UPDATE_DOWNLOAD_TIME_MS', 2000),
      failCheck: config?.failCheck ?? getEnvBool('FAKE_UPDATE_FAIL_CHECK', false),
      failDownload: config?.failDownload ?? getEnvBool('FAKE_UPDATE_FAIL_DOWNLOAD', false),
      packageId:
        config?.packageId ?? process.env.FAKE_UPDATE_PACKAGE_ID ?? 'griptape-nodes-desktop',
    }

    logger.info('FakeUpdateManager: Initialized with config:', {
      updateAvailable: this.config.updateAvailable,
      targetVersion: this.config.targetVersion,
      currentVersion: this.config.currentVersion,
      downloadTimeMs: this.config.downloadTimeMs,
      failCheck: this.config.failCheck,
      failDownload: this.config.failDownload,
    })
  }

  getCurrentVersion(): string {
    return this.config.currentVersion
  }

  getAppId(): string {
    return this.config.packageId
  }

  isPortable(): boolean {
    return true
  }

  getUpdatePendingRestart(): UpdateInfo | null {
    return this.downloadedUpdate
  }

  async checkForUpdatesAsync(): Promise<UpdateInfo | null> {
    logger.info('FakeUpdateManager: Checking for updates...')

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (this.config.failCheck) {
      logger.error('FakeUpdateManager: Simulating check failure')
      throw new Error('FakeUpdateManager: Simulated update check failure')
    }

    if (!this.config.updateAvailable) {
      logger.info('FakeUpdateManager: No updates available (configured)')
      return null
    }

    const updateInfo: UpdateInfo = {
      TargetFullRelease: this.createFakeAsset(this.config.targetVersion, 'Full'),
      IsDowngrade: false,
    }

    logger.info(`FakeUpdateManager: Update available - v${this.config.targetVersion}`)
    return updateInfo
  }

  async downloadUpdateAsync(update: UpdateInfo, progress?: (perc: number) => void): Promise<void> {
    logger.info(`FakeUpdateManager: Starting download of v${update.TargetFullRelease.Version}...`)

    if (this.config.failDownload) {
      // Simulate partial progress before failure
      const failAt = Math.floor(Math.random() * 70) + 20 // Fail between 20-90%
      const steps = Math.floor(failAt / 5)
      const stepTime = (this.config.downloadTimeMs * failAt) / 100 / steps

      for (let i = 1; i <= steps; i++) {
        await new Promise((resolve) => setTimeout(resolve, stepTime))
        progress?.(i * 5)
      }

      logger.error('FakeUpdateManager: Simulating download failure')
      throw new Error('FakeUpdateManager: Simulated download failure')
    }

    // Simulate download with progress
    const steps = 20
    const stepTime = this.config.downloadTimeMs / steps

    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, stepTime))
      const percentage = Math.round((i / steps) * 100)
      progress?.(percentage)
    }

    this.downloadedUpdate = update
    logger.info('FakeUpdateManager: Download complete')
  }

  waitExitThenApplyUpdate(
    update: UpdateInfo,
    silent?: boolean,
    restart?: boolean,
    restartArgs?: string[],
  ): void {
    const version = update.TargetFullRelease.Version

    logger.info('FakeUpdateManager: waitExitThenApplyUpdate called', {
      version,
      silent: silent ?? false,
      restart: restart ?? true,
      restartArgs: restartArgs ?? [],
    })

    logger.warn(
      'FakeUpdateManager: In dev mode, update will not be applied. ' +
        'App would restart with the new version in production.',
    )
  }

  private createFakeAsset(version: string, type: 'Full' | 'Delta'): VelopackAsset {
    return {
      PackageId: this.config.packageId,
      Version: version,
      Type: type,
      FileName: `${this.config.packageId}-${version}-${type.toLowerCase()}.nupkg`,
      SHA1: 'fake-sha1-' + version,
      SHA256: 'fake-sha256-' + version,
      Size: BigInt(50 * 1024 * 1024), // 50MB fake size
      NotesMarkdown: '',
      NotesHtml: '',
    }
  }
}

/**
 * Configuration options for FakeEngineUpdateManager.
 */
export interface FakeEngineUpdateConfig {
  /** Whether an engine update is available */
  updateAvailable?: boolean
  /** The current engine version to report */
  currentVersion?: string
  /** The latest engine version to report */
  latestVersion?: string
  /** How long the update simulation takes in ms */
  updateTimeMs?: number
  /** Simulate an update failure */
  failUpdate?: boolean
}

export interface EngineUpdateResult {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
}

/**
 * Fake engine update manager for development mode.
 * Simulates engine update checks and upgrades without requiring the actual GTN binary.
 *
 * Enable by setting FAKE_ENGINE_UPDATE_AVAILABLE=true
 */
export class FakeEngineUpdateManager {
  private config: Required<FakeEngineUpdateConfig>

  constructor(config?: FakeEngineUpdateConfig) {
    this.config = {
      updateAvailable: config?.updateAvailable ?? getEnvBool('FAKE_ENGINE_UPDATE_AVAILABLE', false),
      currentVersion: config?.currentVersion ?? process.env.FAKE_ENGINE_CURRENT_VERSION ?? '0.1.0',
      latestVersion: config?.latestVersion ?? process.env.FAKE_ENGINE_LATEST_VERSION ?? '99.0.0',
      updateTimeMs: config?.updateTimeMs ?? getEnvNumber('FAKE_ENGINE_UPDATE_TIME_MS', 3000),
      failUpdate: config?.failUpdate ?? getEnvBool('FAKE_ENGINE_UPDATE_FAIL', false),
    }

    logger.info('FakeEngineUpdateManager: Initialized with config:', {
      updateAvailable: this.config.updateAvailable,
      currentVersion: this.config.currentVersion,
      latestVersion: this.config.latestVersion,
      updateTimeMs: this.config.updateTimeMs,
      failUpdate: this.config.failUpdate,
    })
  }

  /**
   * Check if fake engine updates are enabled via environment variable.
   */
  static isEnabled(): boolean {
    return getEnvBool('FAKE_ENGINE_UPDATE_AVAILABLE', false)
  }

  /**
   * Get the engine update behavior override from environment variable.
   * Returns null if not set (use settings value).
   */
  static getBehaviorOverride(): UpdateBehavior | null {
    const value = process.env.FAKE_ENGINE_UPDATE_BEHAVIOR
    if (value === 'auto-update' || value === 'prompt' || value === 'silence') {
      return value
    }
    return null
  }

  /**
   * Simulate checking for engine updates.
   */
  async checkForUpdate(): Promise<EngineUpdateResult> {
    logger.info('FakeEngineUpdateManager: Checking for engine updates...')

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    if (!this.config.updateAvailable) {
      logger.info('FakeEngineUpdateManager: No engine updates available (configured)')
      return {
        currentVersion: this.config.currentVersion,
        latestVersion: null,
        updateAvailable: false,
      }
    }

    logger.info(
      `FakeEngineUpdateManager: Engine update available - v${this.config.currentVersion} -> v${this.config.latestVersion}`,
    )

    return {
      currentVersion: this.config.currentVersion,
      latestVersion: this.config.latestVersion,
      updateAvailable: true,
    }
  }

  /**
   * Simulate performing an engine update (the upgrade step only).
   * Engine stop/start is handled by the caller.
   */
  async performUpdate(onProgress?: (message: string) => void): Promise<void> {
    logger.info('FakeEngineUpdateManager: Simulating engine upgrade...')

    const steps = ['Downloading update...', 'Extracting files...', 'Installing update...']
    const stepTime = this.config.updateTimeMs / steps.length

    for (let i = 0; i < steps.length; i++) {
      onProgress?.(steps[i])
      logger.info(`FakeEngineUpdateManager: ${steps[i]}`)
      await new Promise((resolve) => setTimeout(resolve, stepTime))

      // Simulate failure midway if configured
      if (this.config.failUpdate && i === Math.floor(steps.length / 2)) {
        logger.error('FakeEngineUpdateManager: Simulating update failure')
        throw new Error('FakeEngineUpdateManager: Simulated engine update failure')
      }
    }

    logger.info('FakeEngineUpdateManager: Upgrade simulation complete')
  }
}
