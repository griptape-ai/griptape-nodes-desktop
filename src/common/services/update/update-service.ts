import { UpdateManager } from 'velopack';
import Store from 'electron-store';
import { logger } from '@/main/utils/logger';

interface UpdateStoreData {
  selectedChannel?: string;
}

declare const __VELOPACK_CHANNEL__: string | undefined;

export class UpdateService {
  private updateManager: UpdateManager;
  private store: any;
  private isPackaged: boolean;
  private buildChannel: string | null;
  private baseUpdateUrl = 'https://griptape-nodes-desktop-releases.s3.us-west-2.amazonaws.com';

  constructor(isPackaged: boolean) {
    this.isPackaged = isPackaged;
    this.store = new Store<UpdateStoreData>({
      name: 'update-config',
      defaults: {}
    });

    // Get the build-time channel (will be undefined when not packaged)
    this.buildChannel = typeof __VELOPACK_CHANNEL__ !== 'undefined' ? __VELOPACK_CHANNEL__ : null;

    // Create update manager with proper configuration
    this.updateManager = this.createUpdateManager();
  }

  private createUpdateManager(): UpdateManager {
    // Get the selected channel (or use build channel as default)
    const channel = this.getChannel();
    const logicalChannel = channel ? this.extractLogicalChannelName(channel) : null;

    // Build the update URL with the logical channel name in the path
    const updateUrl = channel
      ? `${this.baseUpdateUrl}/${logicalChannel}`
      : this.baseUpdateUrl;

    // Create UpdateManager with URL and options
    const options = {
      AllowVersionDowngrade: false,
      MaximumDeltasBeforeFallback: 10,
      ...(channel ? { ExplicitChannel: channel } : {})
    };

    logger.info(`UpdateService: Configured with channel: ${channel}, URL: ${updateUrl}`);
    return new UpdateManager(updateUrl, options);
  }

  /**
   * Check if updates are supported (only in packaged apps)
   */
  isUpdateSupported(): boolean {
    return this.isPackaged;
  }

  /**
   * Get the current channel
   */
  getChannel(): string | null {
    if (!this.isPackaged) {
      return null;
    }

    // Return stored channel, or build channel, or default to stable
    const storedChannel = this.store.get('selectedChannel');
    return storedChannel || this.buildChannel || 'stable';
  }

  /**
   * Set a new channel
   */
  setChannel(channel: string): void {
    if (!this.isPackaged) {
      throw new Error('Cannot set channel in unpackaged app');
    }

    this.store.set('selectedChannel', channel);

    // Recreate the update manager with the new channel
    this.updateManager = this.createUpdateManager();
    logger.info(`UpdateService: Channel changed to: ${channel}`);
  }

  /**
   * Extract logical channel name by removing OS/arch prefixes
   */
  private extractLogicalChannelName(channel: string): string {
    // Remove common OS/arch prefixes (e.g., "win-x64-", "linux-x64-", "darwin-arm64-", etc.)
    const prefixPattern = /^(win|linux|darwin|osx)-(x64|arm64|x86)-/;
    return channel.replace(prefixPattern, '');
  }

  /**
   * Get available channels
   */
  getAvailableChannels(): string[] {
    if (!this.isPackaged) {
      return [];
    }

    const channels = new Set<string>();

    // Add build channel if it exists
    if (this.buildChannel) {
      channels.add(this.buildChannel);
    }

    return Array.from(channels);
  }

  /**
   * Get the logical (display) name for a channel
   */
  getLogicalChannelName(channel: string): string {
    return this.extractLogicalChannelName(channel);
  }

  /**
   * Get the current version
   */
  getCurrentVersion(): string {
    if (!this.isPackaged) {
      return 'dev';
    }
    return this.updateManager.getCurrentVersion();
  }

  /**
   * Get the update manager instance (for checking/downloading updates)
   */
  getUpdateManager(): UpdateManager {
    if (!this.isPackaged) {
      throw new Error('Update manager not available in unpackaged app');
    }
    return this.updateManager;
  }
}
