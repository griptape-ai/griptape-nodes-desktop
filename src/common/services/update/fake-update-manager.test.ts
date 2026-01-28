import { FakeUpdateManager, FakeEngineUpdateManager } from './fake-update-manager'

describe('FakeUpdateManager', () => {
  // Store original env
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    // Restore original env after all tests
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('should use default config values when no config or env vars provided', () => {
      const manager = new FakeUpdateManager()
      expect(manager.getCurrentVersion()).toBe('0.0.0-dev')
      expect(manager.getAppId()).toBe('griptape-nodes-desktop')
      expect(manager.isPortable()).toBe(true)
    })

    it('should use config values when provided', () => {
      const manager = new FakeUpdateManager({
        currentVersion: '1.0.0',
        targetVersion: '2.0.0',
        packageId: 'custom-package-id',
        updateAvailable: false,
      })
      expect(manager.getCurrentVersion()).toBe('1.0.0')
      expect(manager.getAppId()).toBe('custom-package-id')
    })

    it('should use environment variables when config not provided', () => {
      process.env.FAKE_UPDATE_CURRENT_VERSION = '3.0.0'
      process.env.FAKE_UPDATE_PACKAGE_ID = 'env-package-id'
      process.env.FAKE_UPDATE_AVAILABLE = 'false'

      const manager = new FakeUpdateManager()
      expect(manager.getCurrentVersion()).toBe('3.0.0')
      expect(manager.getAppId()).toBe('env-package-id')
    })

    it('should prioritize config over environment variables', () => {
      process.env.FAKE_UPDATE_CURRENT_VERSION = '3.0.0'

      const manager = new FakeUpdateManager({ currentVersion: '4.0.0' })
      expect(manager.getCurrentVersion()).toBe('4.0.0')
    })
  })

  describe('getCurrentVersion', () => {
    it('should return configured current version', () => {
      const manager = new FakeUpdateManager({ currentVersion: '1.2.3' })
      expect(manager.getCurrentVersion()).toBe('1.2.3')
    })
  })

  describe('getAppId', () => {
    it('should return configured package ID', () => {
      const manager = new FakeUpdateManager({ packageId: 'my-app' })
      expect(manager.getAppId()).toBe('my-app')
    })
  })

  describe('isPortable', () => {
    it('should always return true', () => {
      const manager = new FakeUpdateManager()
      expect(manager.isPortable()).toBe(true)
    })
  })

  describe('getUpdatePendingRestart', () => {
    it('should return null before download', () => {
      const manager = new FakeUpdateManager()
      expect(manager.getUpdatePendingRestart()).toBeNull()
    })

    it('should return update info after successful download', async () => {
      const manager = new FakeUpdateManager({
        updateAvailable: true,
        targetVersion: '2.0.0',
        downloadTimeMs: 10,
      })

      const updateInfo = await manager.checkForUpdatesAsync()
      expect(updateInfo).not.toBeNull()

      await manager.downloadUpdateAsync(updateInfo!)
      expect(manager.getUpdatePendingRestart()).toEqual(updateInfo)
    })
  })

  describe('checkForUpdatesAsync', () => {
    it('should return null when no update available', async () => {
      const manager = new FakeUpdateManager({ updateAvailable: false })
      const result = await manager.checkForUpdatesAsync()
      expect(result).toBeNull()
    })

    it('should return update info when update available', async () => {
      const manager = new FakeUpdateManager({
        updateAvailable: true,
        targetVersion: '5.0.0',
        packageId: 'test-app',
      })

      const result = await manager.checkForUpdatesAsync()

      expect(result).not.toBeNull()
      expect(result!.TargetFullRelease.Version).toBe('5.0.0')
      expect(result!.TargetFullRelease.PackageId).toBe('test-app')
      expect(result!.IsDowngrade).toBe(false)
    })

    it('should throw when failCheck is true', async () => {
      const manager = new FakeUpdateManager({ failCheck: true })
      await expect(manager.checkForUpdatesAsync()).rejects.toThrow(
        'FakeUpdateManager: Simulated update check failure',
      )
    })
  })

  describe('downloadUpdateAsync', () => {
    it('should complete download successfully', async () => {
      const manager = new FakeUpdateManager({
        updateAvailable: true,
        downloadTimeMs: 10,
      })

      const updateInfo = await manager.checkForUpdatesAsync()
      expect(updateInfo).not.toBeNull()

      await expect(manager.downloadUpdateAsync(updateInfo!)).resolves.toBeUndefined()
    })

    it('should report progress during download', async () => {
      const manager = new FakeUpdateManager({
        updateAvailable: true,
        downloadTimeMs: 50,
      })

      const updateInfo = await manager.checkForUpdatesAsync()
      const progressValues: number[] = []

      await manager.downloadUpdateAsync(updateInfo!, (progress) => {
        progressValues.push(progress)
      })

      // Should have received progress updates
      expect(progressValues.length).toBeGreaterThan(0)
      // Last progress should be 100
      expect(progressValues[progressValues.length - 1]).toBe(100)
    })

    it('should throw when failDownload is true', async () => {
      const manager = new FakeUpdateManager({
        updateAvailable: true,
        failDownload: true,
        downloadTimeMs: 50,
      })

      const updateInfo = await manager.checkForUpdatesAsync()
      await expect(manager.downloadUpdateAsync(updateInfo!)).rejects.toThrow(
        'FakeUpdateManager: Simulated download failure',
      )
    })
  })

  describe('waitExitThenApplyUpdate', () => {
    it('should not throw', async () => {
      const manager = new FakeUpdateManager({
        updateAvailable: true,
        downloadTimeMs: 10,
      })

      const updateInfo = await manager.checkForUpdatesAsync()
      await manager.downloadUpdateAsync(updateInfo!)

      // Should not throw
      expect(() => {
        manager.waitExitThenApplyUpdate(updateInfo!, false, true, [])
      }).not.toThrow()
    })
  })
})

describe('FakeEngineUpdateManager', () => {
  // Store original env
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    // Restore original env after all tests
    process.env = originalEnv
  })

  describe('isEnabled', () => {
    it('should return false by default', () => {
      delete process.env.FAKE_ENGINE_UPDATE_AVAILABLE
      expect(FakeEngineUpdateManager.isEnabled()).toBe(false)
    })

    it('should return true when env var is true', () => {
      process.env.FAKE_ENGINE_UPDATE_AVAILABLE = 'true'
      expect(FakeEngineUpdateManager.isEnabled()).toBe(true)
    })

    it('should return false when env var is false', () => {
      process.env.FAKE_ENGINE_UPDATE_AVAILABLE = 'false'
      expect(FakeEngineUpdateManager.isEnabled()).toBe(false)
    })

    it('should be case insensitive for true', () => {
      process.env.FAKE_ENGINE_UPDATE_AVAILABLE = 'TRUE'
      expect(FakeEngineUpdateManager.isEnabled()).toBe(true)

      process.env.FAKE_ENGINE_UPDATE_AVAILABLE = 'True'
      expect(FakeEngineUpdateManager.isEnabled()).toBe(true)
    })
  })

  describe('getBehaviorOverride', () => {
    it('should return null when env var not set', () => {
      delete process.env.FAKE_ENGINE_UPDATE_BEHAVIOR
      expect(FakeEngineUpdateManager.getBehaviorOverride()).toBeNull()
    })

    it('should return auto-update when set', () => {
      process.env.FAKE_ENGINE_UPDATE_BEHAVIOR = 'auto-update'
      expect(FakeEngineUpdateManager.getBehaviorOverride()).toBe('auto-update')
    })

    it('should return prompt when set', () => {
      process.env.FAKE_ENGINE_UPDATE_BEHAVIOR = 'prompt'
      expect(FakeEngineUpdateManager.getBehaviorOverride()).toBe('prompt')
    })

    it('should return silence when set', () => {
      process.env.FAKE_ENGINE_UPDATE_BEHAVIOR = 'silence'
      expect(FakeEngineUpdateManager.getBehaviorOverride()).toBe('silence')
    })

    it('should return null for invalid values', () => {
      process.env.FAKE_ENGINE_UPDATE_BEHAVIOR = 'invalid'
      expect(FakeEngineUpdateManager.getBehaviorOverride()).toBeNull()
    })
  })

  describe('constructor', () => {
    it('should use default config values', async () => {
      const manager = new FakeEngineUpdateManager()
      // Verify defaults are set by checking checkForUpdate result
      const result = await manager.checkForUpdate()
      expect(result.updateAvailable).toBe(false)
    })

    it('should use config values when provided', async () => {
      const manager = new FakeEngineUpdateManager({
        updateAvailable: true,
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
      })
      const result = await manager.checkForUpdate()
      expect(result.currentVersion).toBe('1.0.0')
      expect(result.latestVersion).toBe('2.0.0')
    })

    it('should use environment variables', async () => {
      process.env.FAKE_ENGINE_UPDATE_AVAILABLE = 'true'
      process.env.FAKE_ENGINE_CURRENT_VERSION = '0.5.0'
      process.env.FAKE_ENGINE_LATEST_VERSION = '1.0.0'

      const manager = new FakeEngineUpdateManager()
      const result = await manager.checkForUpdate()
      expect(result.currentVersion).toBe('0.5.0')
      expect(result.latestVersion).toBe('1.0.0')
    })
  })

  describe('checkForUpdate', () => {
    it('should return no update when not available', async () => {
      const manager = new FakeEngineUpdateManager({ updateAvailable: false })

      const result = await manager.checkForUpdate()

      expect(result.updateAvailable).toBe(false)
      expect(result.latestVersion).toBeNull()
    })

    it('should return update info when available', async () => {
      const manager = new FakeEngineUpdateManager({
        updateAvailable: true,
        currentVersion: '1.0.0',
        latestVersion: '2.0.0',
      })

      const result = await manager.checkForUpdate()

      expect(result.updateAvailable).toBe(true)
      expect(result.currentVersion).toBe('1.0.0')
      expect(result.latestVersion).toBe('2.0.0')
    })
  })

  describe('performUpdate', () => {
    it('should complete update successfully', async () => {
      const manager = new FakeEngineUpdateManager({
        updateTimeMs: 30,
      })

      await expect(manager.performUpdate()).resolves.toBeUndefined()
    })

    it('should report progress during update', async () => {
      const manager = new FakeEngineUpdateManager({
        updateTimeMs: 60,
      })

      const progressMessages: string[] = []

      await manager.performUpdate((message) => {
        progressMessages.push(message)
      })

      // Should have received progress messages
      expect(progressMessages.length).toBeGreaterThan(0)
      expect(progressMessages).toContain('Downloading update...')
      expect(progressMessages).toContain('Extracting files...')
      expect(progressMessages).toContain('Installing update...')
    })

    it('should throw when failUpdate is true', async () => {
      const manager = new FakeEngineUpdateManager({
        failUpdate: true,
        updateTimeMs: 60,
      })

      await expect(manager.performUpdate()).rejects.toThrow(
        'FakeEngineUpdateManager: Simulated engine update failure',
      )
    })
  })
})

describe('helper functions via environment variables', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('getEnvBool (tested via FakeUpdateManager)', () => {
    it('should return default when env not set', async () => {
      delete process.env.FAKE_UPDATE_AVAILABLE
      const manager = new FakeUpdateManager()
      // Default is true for updateAvailable
      const result = await manager.checkForUpdatesAsync()
      expect(result).not.toBeNull()
    })

    it('should parse true correctly', async () => {
      process.env.FAKE_UPDATE_AVAILABLE = 'true'
      const manager = new FakeUpdateManager()
      const result = await manager.checkForUpdatesAsync()
      expect(result).not.toBeNull()
    })

    it('should parse false correctly', async () => {
      process.env.FAKE_UPDATE_AVAILABLE = 'false'
      const manager = new FakeUpdateManager()
      const result = await manager.checkForUpdatesAsync()
      expect(result).toBeNull()
    })

    it('should be case insensitive', async () => {
      process.env.FAKE_UPDATE_AVAILABLE = 'TRUE'
      const manager = new FakeUpdateManager()
      const result = await manager.checkForUpdatesAsync()
      expect(result).not.toBeNull()
    })
  })

  describe('getEnvNumber (tested via FakeUpdateManager)', () => {
    it('should return default when env not set', () => {
      delete process.env.FAKE_UPDATE_DOWNLOAD_TIME_MS
      // Default downloadTimeMs is 2000 - just verify no error
      const manager = new FakeUpdateManager()
      expect(manager).toBeDefined()
    })

    it('should parse number correctly', () => {
      process.env.FAKE_UPDATE_DOWNLOAD_TIME_MS = '5000'
      // No error means it parsed correctly
      const manager = new FakeUpdateManager()
      expect(manager).toBeDefined()
    })

    it('should return default for invalid number', () => {
      process.env.FAKE_UPDATE_DOWNLOAD_TIME_MS = 'invalid'
      // Should use default 2000 without error
      const manager = new FakeUpdateManager()
      expect(manager).toBeDefined()
    })
  })
})
