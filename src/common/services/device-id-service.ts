import Store from 'electron-store'
import { logger } from '@/main/utils/logger'

interface DeviceIdSchema {
  deviceId: string
  generatedAt: string
}

export class DeviceIdService {
  private store: any
  private cachedDeviceId: string | null = null

  constructor() {
    this.store = new Store<DeviceIdSchema>({
      name: 'device-info'
    })
  }

  start() {
    logger.info('DeviceIdService: Started')
  }

  async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) {
      return this.cachedDeviceId
    }

    // Check if we already have a stored device ID
    const stored = this.store.get('deviceId')
    if (stored) {
      logger.info('DeviceIdService: Using stored device ID')
      this.cachedDeviceId = stored
      return stored
    }

    // Generate new device ID
    const deviceId = this.generateUuid()
    const generatedAt = new Date().toISOString()

    // Store it
    this.store.set('deviceId', deviceId)
    this.store.set('generatedAt', generatedAt)

    logger.info('DeviceIdService: Generated new device ID')

    this.cachedDeviceId = deviceId
    return deviceId
  }

  private generateUuid(): string {
    // Generate a simple UUID v4-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  // Get information about the device ID for debugging/transparency
  getDeviceIdInfo(): DeviceIdSchema | null {
    const deviceId = this.store.get('deviceId')
    const generatedAt = this.store.get('generatedAt')

    if (!deviceId) {
      return null
    }

    return {
      deviceId,
      generatedAt
    }
  }

  // For testing/debugging - reset device ID
  resetDeviceId(): void {
    this.store.clear()
    this.cachedDeviceId = null
    logger.info('DeviceIdService: Device ID reset')
  }
}
