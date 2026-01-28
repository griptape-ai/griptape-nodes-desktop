import { getEnv } from './env'

// Mock the paths module
jest.mock('./paths', () => ({
  getPythonInstallDir: jest.fn((dir: string) => `${dir}/python`),
  getUvToolDir: jest.fn((dir: string) => `${dir}/uv-tools`),
  getUvToolBinDir: jest.fn((dir: string) => `${dir}/uv-tools/bin`),
  getXdgConfigHome: jest.fn((dir: string) => `${dir}/xdg_config_home`),
  getXdgDataHome: jest.fn((dir: string) => `${dir}/xdg_data_home`),
}))

describe('getEnv', () => {
  const userDataDir = '/test/user/data'

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks()
  })

  it('should return environment with UV settings', () => {
    const env = getEnv(userDataDir)

    expect(env.UV_MANAGED_PYTHON).toBe('1')
    expect(env.UV_NO_CONFIG).toBe('1')
    expect(env.UV_NO_MODIFY_PATH).toBe('1')
    expect(env.UV_PYTHON_INSTALL_REGISTRY).toBe('0')
    expect(env.UV_NO_PROGRESS).toBe('1')
  })

  it('should set Python install directory', () => {
    const env = getEnv(userDataDir)

    expect(env.UV_PYTHON_INSTALL_DIR).toBe(`${userDataDir}/python`)
  })

  it('should set UV tool directories', () => {
    const env = getEnv(userDataDir)

    expect(env.UV_TOOL_DIR).toBe(`${userDataDir}/uv-tools`)
    expect(env.UV_TOOL_BIN_DIR).toBe(`${userDataDir}/uv-tools/bin`)
  })

  it('should set XDG directories', () => {
    const env = getEnv(userDataDir)

    expect(env.XDG_CONFIG_HOME).toBe(`${userDataDir}/xdg_config_home`)
    expect(env.XDG_DATA_HOME).toBe(`${userDataDir}/xdg_data_home`)
  })

  it('should set GTN config log level', () => {
    const env = getEnv(userDataDir)

    expect(env.GTN_CONFIG_LOG_LEVEL).toBe('DEBUG')
  })

  it('should preserve existing process.env variables', () => {
    // Set some env vars
    const originalPath = process.env.PATH
    const originalHome = process.env.HOME

    const env = getEnv(userDataDir)

    // Original env vars should be preserved
    // Use type assertion since env spreads process.env
    expect((env as any).PATH).toBe(originalPath)
    expect((env as any).HOME).toBe(originalHome)
  })

  it('should work with different user data directories', () => {
    const windowsPath = 'C:\\Users\\test\\AppData\\Roaming\\gtn'
    const env = getEnv(windowsPath)

    expect(env.UV_PYTHON_INSTALL_DIR).toBe(`${windowsPath}/python`)
    expect(env.UV_TOOL_DIR).toBe(`${windowsPath}/uv-tools`)
    expect(env.UV_TOOL_BIN_DIR).toBe(`${windowsPath}/uv-tools/bin`)
  })

  it('should return new object each time (not cached)', () => {
    const env1 = getEnv(userDataDir)
    const env2 = getEnv(userDataDir)

    // Should be equal but not same reference
    expect(env1).toEqual(env2)
    expect(env1).not.toBe(env2)
  })
})
