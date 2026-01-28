import { SettingsService } from './settings-service'

// We need to mock electron-store to track delete calls
const mockStore = {
  data: {} as Record<string, unknown>,
  get: jest.fn((key: string, defaultValue?: unknown) => {
    return mockStore.data[key] !== undefined ? mockStore.data[key] : defaultValue
  }),
  set: jest.fn((key: string, value: unknown) => {
    mockStore.data[key] = value
  }),
  delete: jest.fn((key: string) => {
    delete mockStore.data[key]
  })
}

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => mockStore)
})

describe('SettingsService', () => {
  let service: SettingsService

  beforeEach(() => {
    // Clear mock store data before each test
    mockStore.data = {}
    mockStore.get.mockClear()
    mockStore.set.mockClear()
    mockStore.delete.mockClear()
    service = new SettingsService()
  })

  describe('showSystemMonitor', () => {
    it('should return false by default', () => {
      expect(service.getShowSystemMonitor()).toBe(false)
    })

    it('should set and get showSystemMonitor', () => {
      service.setShowSystemMonitor(true)
      mockStore.data['showSystemMonitor'] = true
      expect(service.getShowSystemMonitor()).toBe(true)
    })
  })

  describe('engineChannel', () => {
    it('should return stable by default', () => {
      expect(service.getEngineChannel()).toBe('stable')
    })

    it('should set and get engineChannel', () => {
      service.setEngineChannel('nightly')
      mockStore.data['engineChannel'] = 'nightly'
      expect(service.getEngineChannel()).toBe('nightly')
    })
  })

  describe('channelSwitchInProgress', () => {
    it('should return false by default', () => {
      expect(service.isChannelSwitchInProgress()).toBe(false)
    })

    it('should set and get channelSwitchInProgress', () => {
      service.setChannelSwitchInProgress(true)
      mockStore.data['channelSwitchInProgress'] = true
      expect(service.isChannelSwitchInProgress()).toBe(true)
    })
  })

  describe('editorChannel', () => {
    it('should return stable by default', () => {
      expect(service.getEditorChannel()).toBe('stable')
    })

    it('should set and get editorChannel', () => {
      service.setEditorChannel('nightly')
      mockStore.data['editorChannel'] = 'nightly'
      expect(service.getEditorChannel()).toBe('nightly')
    })
  })

  describe('updateBehavior', () => {
    it('should return prompt by default', () => {
      expect(service.getUpdateBehavior()).toBe('prompt')
    })

    it('should set and get updateBehavior', () => {
      service.setUpdateBehavior('auto-update')
      mockStore.data['updateBehavior'] = 'auto-update'
      expect(service.getUpdateBehavior()).toBe('auto-update')
    })

    it('should migrate boolean true to auto-update', () => {
      mockStore.data['autoDownloadUpdates'] = true

      const result = service.getUpdateBehavior()

      expect(result).toBe('auto-update')
      expect(mockStore.set).toHaveBeenCalledWith('updateBehavior', 'auto-update')
      expect(mockStore.delete).toHaveBeenCalledWith('autoDownloadUpdates')
    })

    it('should migrate boolean false to prompt', () => {
      mockStore.data['autoDownloadUpdates'] = false

      const result = service.getUpdateBehavior()

      expect(result).toBe('prompt')
      expect(mockStore.set).toHaveBeenCalledWith('updateBehavior', 'prompt')
      expect(mockStore.delete).toHaveBeenCalledWith('autoDownloadUpdates')
    })
  })

  describe('dismissedUpdateVersion', () => {
    it('should return null by default', () => {
      expect(service.getDismissedUpdateVersion()).toBe(null)
    })

    it('should set and get dismissedUpdateVersion', () => {
      service.setDismissedUpdateVersion('1.0.0')
      mockStore.data['dismissedUpdateVersion'] = '1.0.0'
      expect(service.getDismissedUpdateVersion()).toBe('1.0.0')
    })

    it('should allow setting to null', () => {
      mockStore.data['dismissedUpdateVersion'] = '1.0.0'
      service.setDismissedUpdateVersion(null)
      mockStore.data['dismissedUpdateVersion'] = null
      expect(service.getDismissedUpdateVersion()).toBe(null)
    })
  })

  describe('dismissedEngineUpdateVersion', () => {
    it('should return null by default', () => {
      expect(service.getDismissedEngineUpdateVersion()).toBe(null)
    })

    it('should set and get dismissedEngineUpdateVersion', () => {
      service.setDismissedEngineUpdateVersion('2.0.0')
      mockStore.data['dismissedEngineUpdateVersion'] = '2.0.0'
      expect(service.getDismissedEngineUpdateVersion()).toBe('2.0.0')
    })
  })

  describe('engineUpdateBehavior', () => {
    it('should return prompt by default', () => {
      expect(service.getEngineUpdateBehavior()).toBe('prompt')
    })

    it('should set and get engineUpdateBehavior', () => {
      service.setEngineUpdateBehavior('auto-update')
      mockStore.data['engineUpdateBehavior'] = 'auto-update'
      expect(service.getEngineUpdateBehavior()).toBe('auto-update')
    })
  })

  describe('localEnginePath', () => {
    it('should return null by default', () => {
      expect(service.getLocalEnginePath()).toBe(null)
    })

    it('should set and get localEnginePath', () => {
      service.setLocalEnginePath('/path/to/engine')
      mockStore.data['localEnginePath'] = '/path/to/engine'
      expect(service.getLocalEnginePath()).toBe('/path/to/engine')
    })

    it('should allow setting to null', () => {
      mockStore.data['localEnginePath'] = '/path/to/engine'
      service.setLocalEnginePath(null)
      mockStore.data['localEnginePath'] = null
      expect(service.getLocalEnginePath()).toBe(null)
    })
  })

  describe('confirmOnClose', () => {
    it('should return true by default', () => {
      expect(service.getConfirmOnClose()).toBe(true)
    })

    it('should set and get confirmOnClose', () => {
      service.setConfirmOnClose(false)
      mockStore.data['confirmOnClose'] = false
      expect(service.getConfirmOnClose()).toBe(false)
    })
  })

  describe('engineLogFileEnabled', () => {
    it('should return true by default', () => {
      expect(service.getEngineLogFileEnabled()).toBe(true)
    })

    it('should set and get engineLogFileEnabled', () => {
      service.setEngineLogFileEnabled(false)
      mockStore.data['engineLogFileEnabled'] = false
      expect(service.getEngineLogFileEnabled()).toBe(false)
    })
  })

  describe('lastSeenVersion', () => {
    it('should return null by default', () => {
      expect(service.getLastSeenVersion()).toBe(null)
    })

    it('should set and get lastSeenVersion', () => {
      service.setLastSeenVersion('1.2.3')
      mockStore.data['lastSeenVersion'] = '1.2.3'
      expect(service.getLastSeenVersion()).toBe('1.2.3')
    })
  })

  describe('showReleaseNotes', () => {
    it('should return true by default', () => {
      expect(service.getShowReleaseNotes()).toBe(true)
    })

    it('should set and get showReleaseNotes', () => {
      service.setShowReleaseNotes(false)
      mockStore.data['showReleaseNotes'] = false
      expect(service.getShowReleaseNotes()).toBe(false)
    })
  })
})
