import * as path from 'path'

// Save original platform
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

// Helper to mock platform
function mockPlatform(platform: string) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true
  })
}

// Helper to restore platform
function restorePlatform() {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform)
  }
}

// Mock fs module to avoid filesystem operations in getCwd
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  existsSync: jest.fn()
}))

// Import after mocking
import {
  getXdgConfigHome,
  getXdgDataHome,
  getGtnConfigPath,
  getEnginesJsonPath,
  getUvInstallDir,
  getUvExecutablePath,
  getUvToolDir,
  getUvToolBinDir,
  getPythonInstallDir,
  getGtnExecutablePath,
  getEnvironmentInfoPath,
  getCwd
} from './paths'

describe('paths', () => {
  describe('getXdgConfigHome', () => {
    it('should return config home path', () => {
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getXdgConfigHome(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'xdg_config_home'))
    })

    it('should handle Windows paths', () => {
      const userDataPath = 'C:\\Users\\test\\AppData\\Roaming\\gtn'
      const result = getXdgConfigHome(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'xdg_config_home'))
    })
  })

  describe('getXdgDataHome', () => {
    afterEach(() => {
      restorePlatform()
    })

    it('should return data home path on non-Windows', () => {
      mockPlatform('darwin')
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getXdgDataHome(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'xdg_data_home'))
    })

    it('should replace Roaming with Local on Windows', () => {
      mockPlatform('win32')
      const userDataPath = 'C:\\Users\\test\\AppData\\Roaming\\gtn'
      const result = getXdgDataHome(userDataPath)
      expect(result).toBe(path.join('C:\\Users\\test\\AppData\\Local\\gtn', 'xdg_data_home'))
    })

    it('should handle Windows path without Roaming', () => {
      mockPlatform('win32')
      const userDataPath = 'C:\\Users\\test\\AppData\\Local\\gtn'
      const result = getXdgDataHome(userDataPath)
      // No Roaming to replace, path remains as-is
      expect(result).toBe(path.join(userDataPath, 'xdg_data_home'))
    })

    it('should handle Linux paths', () => {
      mockPlatform('linux')
      const userDataPath = '/home/test/.config/gtn'
      const result = getXdgDataHome(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'xdg_data_home'))
    })
  })

  describe('getGtnConfigPath', () => {
    afterEach(() => {
      restorePlatform()
    })

    it('should return GTN config path', () => {
      mockPlatform('darwin')
      const userDataDir = '/Users/test/Library/Application Support/gtn'
      const result = getGtnConfigPath(userDataDir)
      expect(result).toBe(
        path.join(userDataDir, 'xdg_config_home', 'griptape_nodes', 'griptape_nodes_config.json')
      )
    })
  })

  describe('getEnginesJsonPath', () => {
    afterEach(() => {
      restorePlatform()
    })

    it('should return engines.json path on macOS', () => {
      mockPlatform('darwin')
      const userDataDir = '/Users/test/Library/Application Support/gtn'
      const result = getEnginesJsonPath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'xdg_data_home', 'griptape_nodes', 'engines.json'))
    })

    it('should return engines.json path on Windows (using Local)', () => {
      mockPlatform('win32')
      const userDataDir = 'C:\\Users\\test\\AppData\\Roaming\\gtn'
      const result = getEnginesJsonPath(userDataDir)
      expect(result).toBe(
        path.join(
          'C:\\Users\\test\\AppData\\Local\\gtn',
          'xdg_data_home',
          'griptape_nodes',
          'engines.json'
        )
      )
    })
  })

  describe('getUvInstallDir', () => {
    it('should return UV install directory', () => {
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getUvInstallDir(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'uv'))
    })
  })

  describe('getUvExecutablePath', () => {
    afterEach(() => {
      restorePlatform()
    })

    it('should return uv path on macOS', () => {
      mockPlatform('darwin')
      const userDataDir = '/Users/test/Library/Application Support/gtn'
      const result = getUvExecutablePath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'uv', 'uv'))
    })

    it('should return uv.exe path on Windows', () => {
      mockPlatform('win32')
      const userDataDir = 'C:\\Users\\test\\AppData\\Roaming\\gtn'
      const result = getUvExecutablePath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'uv', 'uv.exe'))
    })

    it('should return uv path on Linux', () => {
      mockPlatform('linux')
      const userDataDir = '/home/test/.config/gtn'
      const result = getUvExecutablePath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'uv', 'uv'))
    })
  })

  describe('getUvToolDir', () => {
    it('should return UV tool directory', () => {
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getUvToolDir(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'uv-tools'))
    })
  })

  describe('getUvToolBinDir', () => {
    it('should return UV tool bin directory', () => {
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getUvToolBinDir(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'uv-tools', 'bin'))
    })
  })

  describe('getPythonInstallDir', () => {
    it('should return Python install directory', () => {
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getPythonInstallDir(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'python'))
    })
  })

  describe('getGtnExecutablePath', () => {
    afterEach(() => {
      restorePlatform()
    })

    it('should return gtn path on macOS', () => {
      mockPlatform('darwin')
      const userDataDir = '/Users/test/Library/Application Support/gtn'
      const result = getGtnExecutablePath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'uv-tools', 'bin', 'gtn'))
    })

    it('should return gtn.exe path on Windows', () => {
      mockPlatform('win32')
      const userDataDir = 'C:\\Users\\test\\AppData\\Roaming\\gtn'
      const result = getGtnExecutablePath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'uv-tools', 'bin', 'gtn.exe'))
    })

    it('should return gtn path on Linux', () => {
      mockPlatform('linux')
      const userDataDir = '/home/test/.config/gtn'
      const result = getGtnExecutablePath(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'uv-tools', 'bin', 'gtn'))
    })
  })

  describe('getEnvironmentInfoPath', () => {
    it('should return environment info path', () => {
      const userDataPath = '/Users/test/Library/Application Support/gtn'
      const result = getEnvironmentInfoPath(userDataPath)
      expect(result).toBe(path.join(userDataPath, 'environment-info.json'))
    })
  })

  describe('getCwd', () => {
    it('should return tmp directory and create it', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs')
      const userDataDir = '/Users/test/Library/Application Support/gtn'
      const result = getCwd(userDataDir)
      expect(result).toBe(path.join(userDataDir, 'tmp'))
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(userDataDir, 'tmp'), { recursive: true })
    })
  })
})
