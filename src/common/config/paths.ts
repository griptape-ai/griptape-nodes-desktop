import * as path from 'path'
import * as fs from 'fs'

export function getXdgConfigHome(userDataPath: string): string {
  return path.join(userDataPath, 'xdg_config_home')
}

export function getXdgDataHome(userDataPath: string): string {
  return path.join(userDataPath, 'xdg_data_home')
}

export function getGtnConfigPath(userDataDir: string): string {
  return path.join(getXdgConfigHome(userDataDir), 'griptape_nodes', 'griptape_nodes_config.json')
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
