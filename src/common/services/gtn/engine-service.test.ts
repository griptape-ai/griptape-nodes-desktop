import { EngineService } from './engine-service'
import type { EngineLog as _EngineLog, EngineStatus as _EngineStatus } from './engine-service'

// Mock dependencies
jest.mock('./gtn-service', () => ({}))
jest.mock('../settings-service', () => ({}))

describe('EngineService', () => {
  let service: EngineService
  const mockGtnService = {
    waitForReady: jest.fn().mockResolvedValue(undefined),
    getGtnExecutablePath: jest.fn().mockResolvedValue('/path/to/gtn')
  }
  const mockSettingsService = {
    getLocalEnginePath: jest.fn().mockReturnValue(null)
  }

  beforeEach(() => {
    service = new EngineService('/user/data', mockGtnService as any, mockSettingsService as any)
  })

  afterEach(() => {
    service.removeAllListeners()
  })

  describe('getLogs and addLog', () => {
    it('should return empty array initially', () => {
      expect(service.getLogs()).toEqual([])
    })

    it('should add log entries', () => {
      service.addLog('stdout', 'test message')

      const logs = service.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].type).toBe('stdout')
      expect(logs[0].message).toBe('test message')
      expect(logs[0].timestamp).toBeInstanceOf(Date)
    })

    it('should add multiple log entries', () => {
      service.addLog('stdout', 'message 1')
      service.addLog('stderr', 'error message')
      service.addLog('stdout', 'message 2')

      const logs = service.getLogs()
      expect(logs).toHaveLength(3)
      expect(logs[0].message).toBe('message 1')
      expect(logs[1].type).toBe('stderr')
      expect(logs[2].message).toBe('message 2')
    })

    it('should emit engine:log event when adding log', () => {
      const listener = jest.fn()
      service.on('engine:log', listener)

      service.addLog('stdout', 'test message')

      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stdout',
          message: 'test message'
        })
      )
    })

    it('should return a copy of logs array', () => {
      service.addLog('stdout', 'test')

      const logs1 = service.getLogs()
      const logs2 = service.getLogs()

      expect(logs1).not.toBe(logs2)
      expect(logs1).toEqual(logs2)
    })
  })

  describe('log trimming', () => {
    it('should trim logs when exceeding maxLogSize', () => {
      // Add more than 1000 logs (default maxLogSize)
      for (let i = 0; i < 1050; i++) {
        service.addLog('stdout', `message ${i}`)
      }

      const logs = service.getLogs()
      expect(logs.length).toBe(1000)
      // First 50 messages should be trimmed
      expect(logs[0].message).toBe('message 50')
      expect(logs[999].message).toBe('message 1049')
    })
  })

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      service.addLog('stdout', 'message 1')
      service.addLog('stdout', 'message 2')

      service.clearLogs()

      expect(service.getLogs()).toEqual([])
    })

    it('should emit engine:logs-cleared event', () => {
      const listener = jest.fn()
      service.on('engine:logs-cleared', listener)

      service.clearLogs()

      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStatus', () => {
    it('should return not-ready initially', () => {
      expect(service.getStatus()).toBe('not-ready')
    })
  })

  describe('setInitializing', () => {
    it('should set status to initializing', () => {
      service.setInitializing()

      expect(service.getStatus()).toBe('initializing')
    })

    it('should add a log message when setting to initializing', () => {
      service.setInitializing()

      const logs = service.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].message).toContain('Setting up')
    })

    it('should emit engine:status-changed event', () => {
      const listener = jest.fn()
      service.on('engine:status-changed', listener)

      service.setInitializing()

      expect(listener).toHaveBeenCalledWith('initializing')
    })
  })

  describe('setError', () => {
    it('should set status to error', () => {
      service.setError()

      expect(service.getStatus()).toBe('error')
    })

    it('should emit engine:status-changed event', () => {
      const listener = jest.fn()
      service.on('engine:status-changed', listener)

      service.setError()

      expect(listener).toHaveBeenCalledWith('error')
    })
  })

  describe('status change events', () => {
    it('should emit event on every setInitializing call', () => {
      const listener = jest.fn()
      service.on('engine:status-changed', listener)

      // setInitializing always emits the event (unlike the private setEngineStatus)
      service.setInitializing()
      expect(listener).toHaveBeenCalledTimes(1)

      // Calling setInitializing again still emits
      service.setInitializing()
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe('waitForReady', () => {
    it('should resolve when service becomes ready', async () => {
      // Start waiting
      const waitPromise = service.waitForReady()

      // Call start which should emit ready
      mockGtnService.waitForReady.mockResolvedValue(undefined)
      await service.start()

      await expect(waitPromise).resolves.toBeUndefined()
    })

    it('should resolve immediately if already ready', async () => {
      await service.start()

      await expect(service.waitForReady()).resolves.toBeUndefined()
    })
  })
})
