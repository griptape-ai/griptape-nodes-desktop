import Store from 'electron-store'
import { logger } from '@/main/utils/logger'
import type { UpdateBehavior } from '@/types/global'

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

  getUpdateBehavior(): UpdateBehavior {
    // Migration: if old boolean setting exists, convert it
    const oldValue = this.store.get('autoDownloadUpdates')
    if (typeof oldValue === 'boolean') {
      const newValue: UpdateBehavior = oldValue ? 'auto-update' : 'prompt'
      this.store.set('updateBehavior', newValue)
      this.store.delete('autoDownloadUpdates')
      logger.info('SettingsService: Migrated autoDownloadUpdates to updateBehavior:', newValue)
      return newValue
    }
    return this.store.get('updateBehavior', 'prompt')
  }

  setUpdateBehavior(behavior: UpdateBehavior): void {
    this.store.set('updateBehavior', behavior)
    logger.info('SettingsService: updateBehavior set to', behavior)
  }

  getDismissedUpdateVersion(): string | null {
    return this.store.get('dismissedUpdateVersion', null)
  }

  setDismissedUpdateVersion(version: string | null): void {
    this.store.set('dismissedUpdateVersion', version)
    logger.info('SettingsService: dismissedUpdateVersion set to', version)
  }

  getDismissedEngineUpdateVersion(): string | null {
    return this.store.get('dismissedEngineUpdateVersion', null)
  }

  setDismissedEngineUpdateVersion(version: string | null): void {
    this.store.set('dismissedEngineUpdateVersion', version)
    logger.info('SettingsService: dismissedEngineUpdateVersion set to', version)
  }

  getEngineUpdateBehavior(): UpdateBehavior {
    return this.store.get('engineUpdateBehavior', 'prompt')
  }

  setEngineUpdateBehavior(behavior: UpdateBehavior): void {
    this.store.set('engineUpdateBehavior', behavior)
    logger.info('SettingsService: engineUpdateBehavior set to', behavior)
  }

  /**
   * Get the local griptape-nodes repository path for development.
   * When set, the engine will run from this path instead of the installed version.
   */
  getLocalEnginePath(): string | null {
    return this.store.get('localEnginePath', null)
  }

  /**
   * Set the local griptape-nodes repository path for development.
   * Set to null to use the installed version.
   */
  setLocalEnginePath(path: string | null): void {
    this.store.set('localEnginePath', path)
    logger.info('SettingsService: localEnginePath set to', path)
  }
}
