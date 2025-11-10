import {
  getPythonInstallDir,
  getUvToolBinDir,
  getUvToolDir,
  getXdgConfigHome,
  getXdgDataHome
} from './paths'

export function getEnv(userDataDir: string) {
  return {
    ...process.env,

    UV_PYTHON_INSTALL_DIR: getPythonInstallDir(userDataDir),
    UV_TOOL_DIR: getUvToolDir(userDataDir),
    UV_TOOL_BIN_DIR: getUvToolBinDir(userDataDir),
    UV_MANAGED_PYTHON: '1',
    UV_NO_CONFIG: '1',
    UV_NO_MODIFY_PATH: '1',
    UV_PYTHON_INSTALL_REGISTRY: '0',
    UV_NO_PROGRESS: '1',
    XDG_CONFIG_HOME: getXdgConfigHome(userDataDir),
    XDG_DATA_HOME: getXdgDataHome(userDataDir),
    GTN_CONFIG_LOG_LEVEL: 'DEBUG'
  }
}
