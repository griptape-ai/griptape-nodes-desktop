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
}
