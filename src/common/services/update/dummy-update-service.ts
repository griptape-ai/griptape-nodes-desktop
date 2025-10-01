import Store from 'electron-store';
import { logger } from '@/main/utils/logger';

interface UpdateStoreData {
  selectedChannel?: string;
}

/**
 * Dummy UpdateService for development mode with fake data
 */
export class DummyUpdateService {
  private store: any;

  constructor() {
    this.store = new Store<UpdateStoreData>({
      name: 'update-config-dev',
      defaults: {}
    });

    logger.info('DummyUpdateService: Running in development mode with fake data');
  }

  /**
   * Check if updates are supported (always false in dev mode)
   */
  isUpdateSupported(): boolean {
    return false;
  }

  /**
   * Get the current channel (fake)
   */
  getChannel(): string | null {
    return this.store.get('selectedChannel') || null;
  }

  /**
   * Set a new channel (fake, for testing UI)
   */
  setChannel(channel: string): void {
    this.store.set('selectedChannel', channel);
    logger.info(`DummyUpdateService: Channel changed to: ${channel}`);
  }

  /**
   * Extract logical channel name by removing OS/arch prefixes
   */
  private extractLogicalChannelName(channel: string): string {
    const prefixPattern = /^(win|linux|darwin|osx)-(x64|arm64|x86)-/;
    return channel.replace(prefixPattern, '');
  }

  /**
   * Get available channels (fake list for testing)
   */
  getAvailableChannels(): string[] {
    return ['darwin-arm64-stable', 'darwin-arm64-beta', 'darwin-arm64-alpha'];
  }

  /**
   * Get the logical (display) name for a channel
   */
  getLogicalChannelName(channel: string): string {
    return this.extractLogicalChannelName(channel);
  }

  /**
   * Get the current version (fake)
   */
  getCurrentVersion(): string {
    return '0.0.0-dev';
  }

  /**
   * Get the update manager instance (throws error in dev mode)
   */
  getUpdateManager(): any {
    throw new Error('Update manager not available in development mode');
  }
}
