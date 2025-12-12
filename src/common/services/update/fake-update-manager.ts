import { logger } from '@/main/utils/logger'
import type { UpdateManager, UpdateInfo, VelopackAsset } from 'velopack'

/**
 * Configuration options for FakeUpdateManager.
 * These can be set via environment variables or passed directly.
 *
 * Environment variables:
 * - FAKE_UPDATE_AVAILABLE: 'true' or 'false' - whether an update is available (default: 'true')
 * - FAKE_UPDATE_VERSION: string - the version to report as available (default: '99.0.0-fake')
 * - FAKE_UPDATE_CURRENT_VERSION: string - the current version to report (default: '0.0.0-dev')
 * - FAKE_UPDATE_DOWNLOAD_TIME_MS: number - how long the download simulation takes in ms (default: 2000)
 * - FAKE_UPDATE_FAIL_CHECK: 'true' or 'false' - simulate check failure (default: 'false')
 * - FAKE_UPDATE_FAIL_DOWNLOAD: 'true' or 'false' - simulate download failure (default: 'false')
 * - FAKE_UPDATE_PACKAGE_ID: string - the package ID to report (default: 'griptape-nodes-desktop')
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
export class FakeUpdateManager implements Pick<UpdateManager,
  'getCurrentVersion' | 'getAppId' | 'isPortable' | 'getUpdatePendingRestart' |
  'checkForUpdatesAsync' | 'downloadUpdateAsync' | 'waitExitThenApplyUpdate'
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
      packageId: config?.packageId ?? process.env.FAKE_UPDATE_PACKAGE_ID ?? 'griptape-nodes-desktop'
    }

    logger.info('FakeUpdateManager: Initialized with config:', {
      updateAvailable: this.config.updateAvailable,
      targetVersion: this.config.targetVersion,
      currentVersion: this.config.currentVersion,
      downloadTimeMs: this.config.downloadTimeMs,
      failCheck: this.config.failCheck,
      failDownload: this.config.failDownload
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

  getUpdatePendingRestart(): VelopackAsset | null {
    if (!this.downloadedUpdate) return null
    return this.downloadedUpdate.TargetFullRelease
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
      DeltasToTarget: [],
      IsDowngrade: false
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
    update: UpdateInfo | VelopackAsset,
    silent?: boolean,
    restart?: boolean,
    restartArgs?: string[]
  ): void {
    const version = 'Version' in update ? update.Version : update.TargetFullRelease.Version

    logger.info('FakeUpdateManager: waitExitThenApplyUpdate called', {
      version,
      silent: silent ?? false,
      restart: restart ?? true,
      restartArgs: restartArgs ?? []
    })

    logger.warn(
      'FakeUpdateManager: In dev mode, update will not be applied. ' +
        'App would restart with the new version in production.'
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
      Size: 50 * 1024 * 1024, // 50MB fake size
      NotesMarkdown: '',
      NotesHtml: ''
    }
  }
}
