import { logger } from '@/main/utils/logger'

/**
 * Fake update manager for development mode that simulates downloads
 */
export class FakeUpdateManager {
  async checkForUpdatesAsync(): Promise<any> {
    logger.info('FakeUpdateManager: Simulating update check...')
    // Simulate a fake update available
    return {
      TargetFullRelease: {
        Version: '0.0.2-dev'
      }
    }
  }

  async downloadUpdateAsync(
    updateInfo: any,
    progressCallback: (progress: number) => void
  ): Promise<void> {
    logger.info('FakeUpdateManager: Simulating update download...')

    // Simulate a download with progress from 0 to 100
    return new Promise((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += 5
        progressCallback(progress)

        if (progress >= 100) {
          clearInterval(interval)
          logger.info('FakeUpdateManager: Fake download complete')
          resolve()
        }
      }, 200) // Update every 200ms for a 4 second total download
    })
  }

  waitExitThenApplyUpdate(_updateInfo: any): void {
    logger.info('FakeUpdateManager: Would apply update (but doing nothing in dev mode)')
  }

  getCurrentVersion(): string {
    return '0.0.0-dev'
  }
}
