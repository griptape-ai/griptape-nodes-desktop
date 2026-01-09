import { UpdateManager } from 'velopack'
import Store from 'electron-store'
import { logger } from '@/main/utils/logger'
import { FakeUpdateManager } from './fake-update-manager'

declare const __VELOPACK_CHANNEL__: string | undefined

export class UpdateService {
  private updateManager: UpdateManager | FakeUpdateManager
  private store: any
  private isPackaged: boolean
  private buildChannel: string | null
  private baseUpdateUrl = 'https://griptape-nodes-desktop-releases.s3.amazonaws.com'

  constructor(isPackaged: boolean) {
    this.isPackaged = isPackaged
    this.store = new Store({
      name: isPackaged ? 'update-config' : 'update-config-dev'
    })

    // Get the build-time channel (will be undefined when not packaged)
    this.buildChannel = typeof __VELOPACK_CHANNEL__ !== 'undefined' ? __VELOPACK_CHANNEL__ : null

    // Create update manager with proper configuration
    this.updateManager = this.createUpdateManager()
  }

  private createUpdateManager(): UpdateManager | FakeUpdateManager {
    // In development mode, use FakeUpdateManager
    if (!this.isPackaged) {
      logger.info('UpdateService: Using FakeUpdateManager for development mode')
      return new FakeUpdateManager()
    }

    // Get the selected channel (or use build channel as default)
    const channel = this.getChannel()
    const logicalChannel = channel ? this.extractLogicalChannelName(channel) : null

    // Build the update URL with the logical channel name in the path
    const updateUrl = channel ? `${this.baseUpdateUrl}/${logicalChannel}` : this.baseUpdateUrl

    // Create UpdateManager with URL and options
    // Note: Only ExplicitChannel and AllowVersionDowngrade are supported in velopack 0.0.1053
    const options = {
      ExplicitChannel: channel,
      AllowVersionDowngrade: true
    }

    logger.info(`UpdateService: Configured with channel: ${channel}, URL: ${updateUrl}`)
    return new UpdateManager(updateUrl, options)
  }

  /**
   * Check if updates are supported (only in packaged apps, but true in dev for testing UI)
   */
  isUpdateSupported(): boolean {
    return true // Return true to allow testing UI in development mode
  }

  /**
   * Get the current channel
   */
  getChannel(): string | null {
    // Return stored channel, or build channel, or default
    const storedChannel = this.store.get('selectedChannel')
    if (!this.isPackaged) {
      // In dev mode, return fake channel
      return storedChannel || 'darwin-arm64-stable'
    }
    return storedChannel || this.buildChannel || 'stable'
  }

  /**
   * Set a new channel
   */
  setChannel(channel: string): void {
    this.store.set('selectedChannel', channel)

    // Recreate the update manager with the new channel (only in packaged mode)
    if (this.isPackaged) {
      this.updateManager = this.createUpdateManager()
    }
    logger.info(`UpdateService: Channel changed to: ${channel}`)
  }

  /**
   * Extract logical channel name by removing OS/arch prefixes
   */
  private extractLogicalChannelName(channel: string): string {
    // Remove common OS/arch prefixes (e.g., "win-x64-", "linux-x64-", "darwin-arm64-", etc.)
    const prefixPattern = /^(win|linux|darwin|osx)-(x64|arm64|x86)-/
    return channel.replace(prefixPattern, '')
  }

  /**
   * Get available channels
   */
  getAvailableChannels(): string[] {
    // In dev mode, return fake channels for testing
    if (!this.isPackaged) {
      return ['darwin-arm64-stable', 'darwin-arm64-beta', 'darwin-arm64-alpha']
    }

    const channels = new Set<string>()

    // Add build channel if it exists
    if (this.buildChannel) {
      channels.add(this.buildChannel)
    }

    return Array.from(channels)
  }

  /**
   * Get the logical (display) name for a channel
   */
  getLogicalChannelName(channel: string): string {
    return this.extractLogicalChannelName(channel)
  }

  /**
   * Get the current version
   */
  getCurrentVersion(): string {
    return this.updateManager.getCurrentVersion()
  }

  /**
   * Get the update manager instance (for checking/downloading updates)
   */
  getUpdateManager(): UpdateManager | FakeUpdateManager {
    return this.updateManager
  }
}
