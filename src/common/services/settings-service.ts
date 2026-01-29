import Store from 'electron-store'
import { logger } from '@/main/utils/logger'
import type { UpdateBehavior } from '@/types/global'

import { DEFAULT_LOG_RETENTION } from '@/common/config/constants'

export type LogRetentionUnit = 'days' | 'months' | 'years' | 'indefinite'

export interface LogRetention {
  value: number
  unit: LogRetentionUnit
}

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
  appLogFileEnabled: boolean
  lastSeenVersion: string | null
  showReleaseNotes: boolean
  logRetention: LogRetention
}

export class SettingsService {
  private store: any

  constructor() {
    // Simple JSON file storage for app settings
    this.store = new Store<SettingsSchema>({
      name: 'settings',
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
   * Get whether app log file writing is enabled.
   */
  getAppLogFileEnabled(): boolean {
    return this.store.get('appLogFileEnabled', true)
  }

  /**
   * Set whether app log file writing is enabled.
   */
  setAppLogFileEnabled(enabled: boolean): void {
    this.store.set('appLogFileEnabled', enabled)
    logger.info('SettingsService: appLogFileEnabled set to', enabled)
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
   * Get log retention settings.
   */
  getLogRetention(): LogRetention {
    return this.store.get('logRetention', DEFAULT_LOG_RETENTION)
  }

  /**
   * Set log retention settings.
   */
  setLogRetention(retention: LogRetention): void {
    this.store.set('logRetention', retention)
    logger.info('SettingsService: logRetention set to', retention)
  }

  /**
   * Get the cutoff date for log retention.
   * Returns null if retention is set to indefinite.
   */
  getLogRetentionCutoffDate(): Date | null {
    const retention = this.getLogRetention()
    if (retention.unit === 'indefinite') {
      return null
    }

    const cutoff = new Date()
    switch (retention.unit) {
      case 'days':
        cutoff.setDate(cutoff.getDate() - retention.value)
        break
      case 'months':
        cutoff.setMonth(cutoff.getMonth() - retention.value)
        break
      case 'years':
        cutoff.setFullYear(cutoff.getFullYear() - retention.value)
        break
    }
    cutoff.setHours(0, 0, 0, 0)
    return cutoff
  }
}
