import { DeviceIdService } from './device-id-service'

describe('DeviceIdService', () => {
  let service: DeviceIdService

  beforeEach(() => {
    service = new DeviceIdService()
  })

  describe('start', () => {
    it('should not throw', () => {
      expect(() => service.start()).not.toThrow()
    })
  })

  describe('getDeviceId', () => {
    it('should generate a UUID-like device ID', async () => {
      const deviceId = await service.getDeviceId()

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(deviceId).toMatch(uuidV4Regex)
    })

    it('should return the same ID on subsequent calls (caching)', async () => {
      const firstId = await service.getDeviceId()
      const secondId = await service.getDeviceId()

      expect(firstId).toBe(secondId)
    })

    it('should use caching within same instance', async () => {
      // Get ID from first call
      const firstId = await service.getDeviceId()

      // Get ID from second call on same instance
      const secondId = await service.getDeviceId()

      // Should return cached ID
      expect(firstId).toBe(secondId)
    })
  })

  describe('getDeviceIdInfo', () => {
    it('should return null before device ID is generated', () => {
      // Fresh service with no stored ID
      const freshService = new DeviceIdService()
      // Note: The mock store starts empty, so this should return null
      // But we need to clear any state from previous tests
      freshService.resetDeviceId()

      const info = freshService.getDeviceIdInfo()
      expect(info).toBeNull()
    })

    it('should return device ID info after ID is generated', async () => {
      const deviceId = await service.getDeviceId()
      const info = service.getDeviceIdInfo()

      expect(info).not.toBeNull()
      expect(info!.deviceId).toBe(deviceId)
      expect(info!.generatedAt).toBeDefined()

      // generatedAt should be a valid ISO date string
      const date = new Date(info!.generatedAt)
      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('resetDeviceId', () => {
    it('should clear the cached device ID', async () => {
      // Generate initial ID
      const firstId = await service.getDeviceId()

      // Reset
      service.resetDeviceId()

      // Should generate a new ID
      const secondId = await service.getDeviceId()

      // IDs should be different (extremely unlikely to be the same)
      expect(secondId).not.toBe(firstId)
    })

    it('should clear stored info', async () => {
      // Generate ID first
      await service.getDeviceId()
      expect(service.getDeviceIdInfo()).not.toBeNull()

      // Reset
      service.resetDeviceId()

      // Info should be null now
      expect(service.getDeviceIdInfo()).toBeNull()
    })
  })

  describe('UUID format validation', () => {
    it('should generate valid UUID v4 format', async () => {
      // Generate multiple IDs and verify format
      for (let i = 0; i < 5; i++) {
        service.resetDeviceId()
        const deviceId = await service.getDeviceId()

        // Check format
        const parts = deviceId.split('-')
        expect(parts.length).toBe(5)
        expect(parts[0].length).toBe(8)
        expect(parts[1].length).toBe(4)
        expect(parts[2].length).toBe(4)
        expect(parts[3].length).toBe(4)
        expect(parts[4].length).toBe(12)

        // Check version nibble (should be 4)
        expect(parts[2][0]).toBe('4')

        // Check variant nibble (should be 8, 9, a, or b)
        expect(['8', '9', 'a', 'b']).toContain(parts[3][0])
      }
    })
  })
})
