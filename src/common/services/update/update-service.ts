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
  private updateUrl = 'https://griptape-nodes-desktop-releases.s3.amazonaws.com';

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
    try {
      // Get the selected channel (or use build channel as default)
      const channel = this.getChannel();

      // Create UpdateManager with URL and options
      const options = {
        AllowVersionDowngrade: false,
        MaximumDeltasBeforeFallback: 10,
        ...(channel && channel !== 'development' ? { ExplicitChannel: channel } : {})
      };

      logger.info(`UpdateService: Configured with channel: ${channel}`);
      return new UpdateManager(this.updateUrl, options);
    } catch (error) {
      logger.error('UpdateService: Failed to configure update manager', error);
      // Return a basic UpdateManager without options
      return new UpdateManager(this.updateUrl);
    }
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
  getChannel(): string {
    if (!this.isPackaged) {
      return 'development';
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
   * Get available channels
   */
  getAvailableChannels(): string[] {
    if (!this.isPackaged) {
      return ['development'];
    }

    const channels = new Set<string>(['stable']);

    // Add build channel if it exists and is not 'stable'
    if (this.buildChannel && this.buildChannel !== 'stable') {
      channels.add(this.buildChannel);
    }

    return Array.from(channels);
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
