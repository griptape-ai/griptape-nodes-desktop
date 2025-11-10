import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

/**
 * Gets the appropriate AppData Roaming path for the current platform.
 * On Windows: %APPDATA% (Roaming)
 * On macOS/Linux: Same as userData (no distinction)
 */
export function getRoamingDataPath(): string {
  if (process.platform === 'win32') {
    // On Windows, use Roaming AppData for config that should sync
    const appName = 'GriptapeNodes'
    return path.join(app.getPath('appData'), appName)
  }
  // On macOS/Linux, use standard userData path
  return app.getPath('userData')
}

/**
 * Gets the appropriate AppData Local path for the current platform.
 * On Windows: %LOCALAPPDATA%
 * On macOS/Linux: Same as userData (no distinction)
 */
export function getLocalDataPath(): string {
  if (process.platform === 'win32') {
    // On Windows, use Local AppData for machine-specific data
    const appName = 'GriptapeNodes'
    const appData = app.getPath('appData')
    // Convert Roaming to Local: C:\Users\{user}\AppData\Roaming -> Local
    const localAppData = appData.replace('Roaming', 'Local')
    return path.join(localAppData, appName)
  }
  // On macOS/Linux, use standard userData path
  return app.getPath('userData')
}

/**
 * XDG_CONFIG_HOME: User preferences and configuration files.
 * On Windows: Maps directly to AppData\Roaming (should sync across machines)
 * On macOS/Linux: Maps directly to userData (no subdirectory)
 */
export function getXdgConfigHome(userDataPath: string): string {
  if (process.platform === 'win32') {
    return getRoamingDataPath()
  }
  return userDataPath
}

/**
 * XDG_DATA_HOME: Application data, libraries, and caches.
 * On Windows: Maps directly to AppData\Local (machine-specific, doesn't roam)
 * On macOS/Linux: Maps directly to userData (no subdirectory)
 */
export function getXdgDataHome(userDataPath: string): string {
  if (process.platform === 'win32') {
    return getLocalDataPath()
  }
  return userDataPath
}

export function getGtnConfigPath(userDataDir: string): string {
  return path.join(getXdgConfigHome(userDataDir), 'griptape_nodes', 'griptape_nodes_config.json')
}

export function getEnginesJsonPath(userDataDir: string): string {
  return path.join(getXdgDataHome(userDataDir), 'griptape_nodes', 'engines.json')
}

export function getUvInstallDir(userDataPath: string): string {
  return path.join(userDataPath, 'uv')
}

export function getUvExecutablePath(userDataDir: string): string {
  const uvInstallDir = getUvInstallDir(userDataDir)
  const uvExecutableName = process.platform === 'win32' ? 'uv.exe' : 'uv'
  return path.join(uvInstallDir, uvExecutableName)
}

export function getUvToolDir(userDataPath: string): string {
  return path.join(userDataPath, 'uv-tools')
}

export function getUvToolBinDir(userDataPath: string): string {
  return path.join(getUvToolDir(userDataPath), 'bin')
}

export function getPythonInstallDir(userDataPath: string): string {
  return path.join(userDataPath, 'python')
}

export function getGtnExecutablePath(userDataDir: string) {
  const uvToolBinDir = getUvToolBinDir(userDataDir)
  const platform = process.platform
  const executableName = platform == 'win32' ? 'gtn.exe' : 'gtn'
  return path.join(uvToolBinDir, executableName)
}

export function getEnvironmentInfoPath(userDataPath: string) {
  return path.join(userDataPath, 'environment-info.json')
}

// An central, writable cwd for spawning subprocesses.
export function getCwd(userDataDir: string) {
  const cwd = path.join(userDataDir, 'tmp')
  fs.mkdirSync(cwd, { recursive: true })
  return cwd
}
