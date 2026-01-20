import Store from 'electron-store'
import { logger } from '@/main/utils/logger'
import type { UpdateBehavior } from '@/types/global'

interface SettingsSchema {
  showSystemMonitor: boolean
  engineChannel: 'stable' | 'nightly'
  channelSwitchInProgress: boolean
  editorChannel: 'stable' | 'nightly'
  localEnginePath: string | null
  updateBehavior: UpdateBehavior
  engineUpdateBehavior: UpdateBehavior
  dismissedUpdateVersion: string | null
  dismissedEngineUpdateVersion: string | null
  confirmOnClose: boolean
  engineLogFileEnabled: boolean
  lastSeenVersion: string | null
  showReleaseNotes: boolean
  engineVerboseLogging: boolean
  engineDebugMode: boolean
}

export class SettingsService {
  private store: any

  constructor() {
    // Simple JSON file storage for app settings
    this.store = new Store<SettingsSchema>({
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

  /**
   * Get whether to show a confirmation dialog when closing the app.
   * Default is true (show the dialog).
   */
  getConfirmOnClose(): boolean {
    return this.store.get('confirmOnClose', true)
  }

  /**
   * Set whether to show a confirmation dialog when closing the app.
   */
  setConfirmOnClose(confirm: boolean): void {
    this.store.set('confirmOnClose', confirm)
    logger.info('SettingsService: confirmOnClose set to', confirm)
  }

  /**
   * Get whether engine log file writing is enabled.
   */
  getEngineLogFileEnabled(): boolean {
    return this.store.get('engineLogFileEnabled', true)
  }

  /**
   * Set whether engine log file writing is enabled.
   */
  setEngineLogFileEnabled(enabled: boolean): void {
    this.store.set('engineLogFileEnabled', enabled)
    logger.info('SettingsService: engineLogFileEnabled set to', enabled)
  }

  /**
   * Get the last app version the user has seen release notes for.
   * Used to determine whether to show the release notes modal after an update.
   */
  getLastSeenVersion(): string | null {
    return this.store.get('lastSeenVersion', null)
  }

  /**
   * Set the last app version the user has seen release notes for.
   */
  setLastSeenVersion(version: string | null): void {
    this.store.set('lastSeenVersion', version)
    logger.info('SettingsService: lastSeenVersion set to', version)
  }

  /**
   * Get whether to show release notes after updates.
   * Default is true (show the modal).
   */
  getShowReleaseNotes(): boolean {
    return this.store.get('showReleaseNotes', true)
  }

  /**
   * Set whether to show release notes after updates.
   */
  setShowReleaseNotes(show: boolean): void {
    this.store.set('showReleaseNotes', show)
    logger.info('SettingsService: showReleaseNotes set to', show)
  }

  /**
   * Get whether verbose logging is enabled for the engine.
   * When enabled, the engine runs with --verbose flag and GTN_LOG_LEVEL=DEBUG.
   */
  getEngineVerboseLogging(): boolean {
    return this.store.get('engineVerboseLogging', false)
  }

  /**
   * Set whether verbose logging is enabled for the engine.
   * Requires engine restart to take effect.
   */
  setEngineVerboseLogging(enabled: boolean): void {
    this.store.set('engineVerboseLogging', enabled)
    logger.info('SettingsService: engineVerboseLogging set to', enabled)
  }

  /**
   * Get whether debug mode is enabled for the engine.
   * When enabled, the engine starts with DEBUGPY_LISTEN_PORT=5678 for remote debugging.
   */
  getEngineDebugMode(): boolean {
    return this.store.get('engineDebugMode', false)
  }

  /**
   * Set whether debug mode is enabled for the engine.
   * Requires engine restart to take effect.
   */
  setEngineDebugMode(enabled: boolean): void {
    this.store.set('engineDebugMode', enabled)
    logger.info('SettingsService: engineDebugMode set to', enabled)
  }
}
