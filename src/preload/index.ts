// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateInfo } from 'velopack'

interface VelopackBridgeApi {
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<UpdateInfo>
  downloadUpdates: (updateInfo: UpdateInfo) => Promise<boolean>
  applyUpdates: (updateInfo: UpdateInfo) => Promise<boolean>
  getChannel: () => Promise<string>
  setChannel: (channel: string) => Promise<boolean>
  getAvailableChannels: () => Promise<string[]>
  getLogicalChannelName: (channel: string) => Promise<string>
}

declare global {
  interface Window {
    velopackApi: VelopackBridgeApi
  }
}

const velopackApi: VelopackBridgeApi = {
  getVersion: () => ipcRenderer.invoke('velopack:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('velopack:check-for-update'),
  downloadUpdates: (updateInfo: UpdateInfo) =>
    ipcRenderer.invoke('velopack:download-update', updateInfo),
  applyUpdates: (updateInfo: UpdateInfo) => ipcRenderer.invoke('velopack:apply-update', updateInfo),
  getChannel: () => ipcRenderer.invoke('velopack:get-channel'),
  setChannel: (channel: string) => ipcRenderer.invoke('velopack:set-channel', channel),
  getAvailableChannels: () => ipcRenderer.invoke('velopack:get-available-channels'),
  getLogicalChannelName: (channel: string) =>
    ipcRenderer.invoke('velopack:get-logical-channel-name', channel)
}

contextBridge.exposeInMainWorld('velopackApi', velopackApi)

contextBridge.exposeInMainWorld('electron', {
  getPreloadPath: () => ipcRenderer.sendSync('get-preload-path'),
  getWebviewPreloadPath: () => ipcRenderer.sendSync('get-webview-preload-path')
})

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('pythonAPI', {
  getEnvironmentInfo: () => ipcRenderer.invoke('get-environment-info'),
  collectEnvironmentInfo: () => ipcRenderer.invoke('collect-environment-info'),
  refreshEnvironmentInfo: () => ipcRenderer.invoke('refresh-environment-info')
})

contextBridge.exposeInMainWorld('oauthAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  cancel: () => ipcRenderer.invoke('auth:cancel'),
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  refreshToken: (refreshToken: string) => ipcRenderer.invoke('auth:refresh-token', refreshToken),
  willPromptForKeychain: () => ipcRenderer.invoke('auth:will-prompt-keychain'),
  hasExistingEncryptedStore: () => ipcRenderer.invoke('auth:has-existing-encrypted-store'),
  loadFromPersistentStore: () => ipcRenderer.invoke('auth:load-from-persistent-store'),
  notifyTokensUpdated: () => ipcRenderer.invoke('auth:notify-tokens-updated')
})

contextBridge.exposeInMainWorld('engineAPI', {
  getStatus: () => ipcRenderer.invoke('engine:get-status'),
  getLogs: () => ipcRenderer.invoke('engine:get-logs'),
  clearLogs: () => ipcRenderer.invoke('engine:clear-logs'),
  start: () => ipcRenderer.invoke('engine:start'),
  stop: () => ipcRenderer.invoke('engine:stop'),
  restart: () => ipcRenderer.invoke('engine:restart'),
  reinstall: () => ipcRenderer.invoke('engine:reinstall'),
  onStatusChanged: (callback: (event: any, status: string) => void) => {
    ipcRenderer.on('engine:status-changed', callback)
  },
  removeStatusChanged: (callback: (event: any, status: string) => void) => {
    ipcRenderer.removeListener('engine:status-changed', callback)
  },
  onLog: (callback: (event: any, log: any) => void) => {
    ipcRenderer.on('engine:log', callback)
  },
  removeLog: (callback: (event: any, log: any) => void) => {
    ipcRenderer.removeListener('engine:log', callback)
  }
})

contextBridge.exposeInMainWorld('editorAPI', {
  requestReloadWebview: () => ipcRenderer.send('editor:reload-webview'),
  onReloadWebview: (callback: () => void) => {
    ipcRenderer.on('editor:do-reload-webview', callback)
  },
  removeReloadWebview: (callback: () => void) => {
    ipcRenderer.removeListener('editor:do-reload-webview', callback)
  }
})

contextBridge.exposeInMainWorld('griptapeAPI', {
  getWorkspace: () => ipcRenderer.invoke('gtn:get-workspace'),
  getDefaultWorkspace: () => ipcRenderer.invoke('gtn:get-default-workspace'),
  setWorkspacePreference: (directory: string) =>
    ipcRenderer.invoke('gtn:set-workspace-preference', directory),
  setWorkspace: (directory: string) => ipcRenderer.invoke('gtn:set-workspace', directory),
  selectDirectory: () => ipcRenderer.invoke('gtn:select-directory'),
  refreshConfig: () => ipcRenderer.invoke('gtn:refresh-config'),
  reconfigureEngine: (config: {
    workspaceDirectory: string
    advancedLibrary: boolean
    cloudLibrary: boolean
  }) => ipcRenderer.invoke('gtn:reconfigure-engine', config),
  upgrade: () => ipcRenderer.invoke('gtn:upgrade'),
  forceReinstall: () => ipcRenderer.invoke('gtn:force-reinstall'),
  getVersion: () => ipcRenderer.invoke('gtn:get-version'),
  checkForEngineUpdate: () => ipcRenderer.invoke('gtn:check-for-engine-update'),
  onWorkspaceChanged: (callback: (event: any, directory: string) => void) => {
    ipcRenderer.on('workspace-changed', callback)
  },
  removeWorkspaceChanged: (callback: (event: any, directory: string) => void) => {
    ipcRenderer.removeListener('workspace-changed', callback)
  }
})

contextBridge.exposeInMainWorld('updateAPI', {
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  isSupported: () => ipcRenderer.invoke('update:is-supported'),
  onDownloadStarted: (callback: () => void) => {
    ipcRenderer.on('update:download-started', callback)
  },
  onDownloadProgress: (callback: (event: any, progress: number) => void) => {
    ipcRenderer.on('update:download-progress', callback)
  },
  onDownloadComplete: (callback: () => void) => {
    ipcRenderer.on('update:download-complete', callback)
  },
  removeDownloadStarted: (callback: () => void) => {
    ipcRenderer.removeListener('update:download-started', callback)
  },
  removeDownloadProgress: (callback: (event: any, progress: number) => void) => {
    ipcRenderer.removeListener('update:download-progress', callback)
  },
  removeDownloadComplete: (callback: () => void) => {
    ipcRenderer.removeListener('update:download-complete', callback)
  }
})

contextBridge.exposeInMainWorld('electronAPI', {
  getEnvVar: (key: string) => ipcRenderer.invoke('get-env-var', key),
  isPackaged: () => ipcRenderer.invoke('is-packaged'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  setCurrentPage: (page: string) => ipcRenderer.send('app:set-current-page', page),
  setFullscreen: (fullscreen: boolean) => ipcRenderer.invoke('window:set-fullscreen', fullscreen),
  onNavigateToSettings: (callback: () => void) => {
    ipcRenderer.on('navigate-to-settings', callback)
  },
  removeNavigateToSettings: (callback: () => void) => {
    ipcRenderer.removeListener('navigate-to-settings', callback)
  }
})

contextBridge.exposeInMainWorld('onboardingAPI', {
  isOnboardingComplete: () => ipcRenderer.invoke('onboarding:is-complete'),
  isCredentialStorageEnabled: () => ipcRenderer.invoke('onboarding:is-credential-storage-enabled'),
  setCredentialStoragePreference: (enabled: boolean) =>
    ipcRenderer.invoke('onboarding:set-credential-storage-preference', enabled),
  completeOnboarding: (credentialStorageEnabled: boolean) =>
    ipcRenderer.invoke('onboarding:complete', credentialStorageEnabled),
  resetOnboarding: () => ipcRenderer.invoke('onboarding:reset'),
  enableCredentialStorage: () => ipcRenderer.invoke('onboarding:enable-credential-storage'),
  testEncryption: () => ipcRenderer.invoke('onboarding:test-encryption'),
  isKeychainVerificationSeen: () => ipcRenderer.invoke('onboarding:is-keychain-verification-seen'),
  setKeychainVerificationSeen: (seen: boolean) =>
    ipcRenderer.invoke('onboarding:set-keychain-verification-seen', seen),
  isWorkspaceSetupComplete: () => ipcRenderer.invoke('onboarding:is-workspace-setup-complete'),
  setWorkspaceSetupComplete: (complete: boolean) =>
    ipcRenderer.invoke('onboarding:set-workspace-setup-complete', complete),
  isAdvancedLibraryEnabled: () => ipcRenderer.invoke('onboarding:is-advanced-library-enabled'),
  setAdvancedLibraryEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('onboarding:set-advanced-library-enabled', enabled),
  isCloudLibraryEnabled: () => ipcRenderer.invoke('onboarding:is-cloud-library-enabled'),
  setCloudLibraryEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('onboarding:set-cloud-library-enabled', enabled)
})

contextBridge.exposeInMainWorld('usageMetricsAPI', {
  reportLaunch: () => ipcRenderer.invoke('usage-metrics:report-launch')
})

contextBridge.exposeInMainWorld('deviceIdAPI', {
  getDeviceId: () => ipcRenderer.invoke('device-id:get'),
  getDeviceIdInfo: () => ipcRenderer.invoke('device-id:get-info'),
  resetDeviceId: () => ipcRenderer.invoke('device-id:reset')
})

contextBridge.exposeInMainWorld('settingsAPI', {
  getShowSystemMonitor: () => ipcRenderer.invoke('settings:get-show-system-monitor'),
  setShowSystemMonitor: (show: boolean) =>
    ipcRenderer.invoke('settings:set-show-system-monitor', show),
  getEngineChannel: () => ipcRenderer.invoke('settings:get-engine-channel'),
  setEngineChannel: (channel: 'stable' | 'nightly') =>
    ipcRenderer.invoke('settings:set-engine-channel', channel),
  getAvailableEngineChannels: () => ipcRenderer.invoke('settings:get-available-engine-channels'),
  isChannelSwitchInProgress: () => ipcRenderer.invoke('settings:is-channel-switch-in-progress')
})

contextBridge.exposeInMainWorld('systemMonitorAPI', {
  getMetrics: () => ipcRenderer.invoke('system-monitor:get-metrics'),
  startMonitoring: () => ipcRenderer.invoke('system-monitor:start-monitoring'),
  stopMonitoring: () => ipcRenderer.invoke('system-monitor:stop-monitoring'),
  onMetricsUpdate: (callback: (metrics: any) => void) => {
    ipcRenderer.on('system-monitor:metrics-update', (_, metrics) => callback(metrics))
  },
  removeMetricsUpdate: (callback: (metrics: any) => void) => {
    ipcRenderer.removeListener('system-monitor:metrics-update', callback)
  }
})
