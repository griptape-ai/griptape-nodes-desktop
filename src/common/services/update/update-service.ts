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
  private isDevelopment: boolean;
  private buildChannel: string | null;
  private updateUrl = 'https://griptape-nodes-desktop-releases.s3.amazonaws.com';

  constructor(isDevelopment: boolean) {
    this.isDevelopment = isDevelopment;
    this.updateManager = new UpdateManager();
    this.store = new Store<UpdateStoreData>({
      name: 'update-config',
      defaults: {}
    });

    // Get the build-time channel (will be undefined in dev)
    this.buildChannel = typeof __VELOPACK_CHANNEL__ !== 'undefined' ? __VELOPACK_CHANNEL__ : null;

    // Configure update manager if not in development
    if (!this.isDevelopment) {
      this.configureUpdateManager();
    }
  }

  private configureUpdateManager(): void {
    try {
      // Set the update source URL
      this.updateManager.setUrlOrPath(this.updateUrl);

      // Get the selected channel (or use build channel as default)
      const channel = this.getChannel();
      if (channel && channel !== 'development') {
        this.updateManager.setExplicitChannel(channel);
        logger.info(`UpdateService: Configured with channel: ${channel}`);
      }
    } catch (error) {
      logger.error('UpdateService: Failed to configure update manager', error);
    }
  }

  /**
   * Check if updates are supported (false in development)
   */
  isUpdateSupported(): boolean {
    return !this.isDevelopment;
  }

  /**
   * Get the current channel
   */
  getChannel(): string {
    if (this.isDevelopment) {
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
    if (this.isDevelopment) {
      throw new Error('Cannot set channel in development mode');
    }

    this.store.set('selectedChannel', channel);

    // Reconfigure the update manager with the new channel
    this.updateManager.setExplicitChannel(channel);
    logger.info(`UpdateService: Channel changed to: ${channel}`);
  }

  /**
   * Get available channels
   */
  getAvailableChannels(): string[] {
    if (this.isDevelopment) {
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
    if (this.isDevelopment) {
      return 'dev';
    }
    return this.updateManager.getCurrentVersion();
  }

  /**
   * Get the update manager instance (for checking/downloading updates)
   */
  getUpdateManager(): UpdateManager {
    if (this.isDevelopment) {
      throw new Error('Update manager not available in development mode');
    }
    return this.updateManager;
  }
}
