import Store from 'electron-store'
import { logger } from '@/main/utils/logger'

export class SettingsService {
  private store: any

  constructor() {
    // Simple JSON file storage for app settings
    this.store = new Store({
      name: 'settings'
    })
  }

  start() {
    logger.info('SettingsService: Started')
  }

  getShowSystemMonitor(): boolean {
    return this.store.get('showSystemMonitor', false)
  }

  setShowSystemMonitor(show: boolean): void {
    this.store.set('showSystemMonitor', show)
    logger.info('SettingsService: showSystemMonitor set to', show)
  }

  getEngineChannel(): 'stable' | 'nightly' {
    return this.store.get('engineChannel', 'stable')
  }

  setEngineChannel(channel: 'stable' | 'nightly'): void {
    this.store.set('engineChannel', channel)
    logger.info('SettingsService: engineChannel set to', channel)
  }

  isChannelSwitchInProgress(): boolean {
    return this.store.get('channelSwitchInProgress', false)
  }

  setChannelSwitchInProgress(inProgress: boolean): void {
    this.store.set('channelSwitchInProgress', inProgress)
    logger.info('SettingsService: channelSwitchInProgress set to', inProgress)
  }

  getEditorChannel(): 'stable' | 'nightly' {
    return this.store.get('editorChannel', 'stable')
  }

  setEditorChannel(channel: 'stable' | 'nightly'): void {
    this.store.set('editorChannel', channel)
    logger.info('SettingsService: editorChannel set to', channel)
  }

  getAutoDownloadUpdates(): boolean {
    return this.store.get('autoDownloadUpdates', false)
  }

  setAutoDownloadUpdates(enabled: boolean): void {
    this.store.set('autoDownloadUpdates', enabled)
    logger.info('SettingsService: autoDownloadUpdates set to', enabled)
  }

  getDismissedUpdateVersion(): string | null {
    return this.store.get('dismissedUpdateVersion', null)
  }

  setDismissedUpdateVersion(version: string | null): void {
    this.store.set('dismissedUpdateVersion', version)
    logger.info('SettingsService: dismissedUpdateVersion set to', version)
  }
}
