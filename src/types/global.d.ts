// Global type declarations for renderer process

export interface EngineLog {
  timestamp: Date
  type: 'stdout' | 'stderr'
  message: string
}

export type EngineStatus = 'not-ready' | 'ready' | 'running' | 'initializing' | 'error'

/**
 * Update behavior setting for both app and engine updates.
 * - 'auto-update': Automatically download and install updates on startup
 * - 'prompt': Show a notification banner when updates are available
 * - 'silence': Do not check for or notify about updates
 */
export type UpdateBehavior = 'auto-update' | 'prompt' | 'silence'

declare global {
  interface Window {
    pythonAPI: {
      getEnvironmentInfo: () => Promise<{
        success: boolean
        data?: {
          build: {
            version: string
            commitHash: string
            commitDate: string
            branch: string
            buildDate: string
            buildId: string
          }
          python: {
            version: string
            executable: string
            installedPackages?: string[]
          }
          griptapeNodes: {
            path: string
            version: string
            installed: boolean
          }
          uv: {
            version: string
            toolDir: string
            pythonInstallDir: string
          }
          system: {
            platform: string
            arch: string
            nodeVersion: string
            electronVersion: string
          }
          collectedAt: string
          errors: string[]
        }
        error?: string
      }>
      collectEnvironmentInfo: () => Promise<{
        success: boolean
        data?: {
          build: {
            version: string
            commitHash: string
            commitDate: string
            branch: string
            buildDate: string
            buildId: string
          }
          python: {
            version: string
            executable: string
            installedPackages?: string[]
          }
          griptapeNodes: {
            path: string
            version: string
            installed: boolean
          }
          uv: {
            version: string
            toolDir: string
            pythonInstallDir: string
          }
          system: {
            platform: string
            arch: string
            nodeVersion: string
            electronVersion: string
          }
          collectedAt: string
          errors: string[]
        }
        error?: string
      }>
      refreshEnvironmentInfo: () => Promise<{
        success: boolean
        data?: {
          build: {
            version: string
            commitHash: string
            commitDate: string
            branch: string
            buildDate: string
            buildId: string
          }
          python: {
            version: string
            executable: string
            installedPackages?: string[]
          }
          griptapeNodes: {
            path: string
            version: string
            installed: boolean
          }
          uv: {
            version: string
            toolDir: string
            pythonInstallDir: string
          }
          system: {
            platform: string
            arch: string
            nodeVersion: string
            electronVersion: string
          }
          collectedAt: string
          errors: string[]
        }
        error?: string
      }>
      onEnvironmentInfoUpdated: (callback: (event: any, info: any) => void) => void
      removeEnvironmentInfoUpdated: (callback: (event: any, info: any) => void) => void
    }
    oauthAPI: {
      login: () => Promise<{
        success: boolean
        tokens?: {
          access_token: string
          id_token: string
          token_type: string
          expires_in: number
        }
        user?: {
          sub: string
          name: string
          email: string
          email_verified: boolean
        }
        apiKey?: string
        error?: string
      }>
      logout: () => Promise<{
        success: boolean
      }>
      cancel: () => Promise<void>
      checkAuth: () => Promise<{
        isAuthenticated: boolean
        apiKey?: string
        expiresAt?: number
        tokens?: {
          access_token: string
          id_token: string
          token_type: string
          expires_in: number
          refresh_token?: string
        }
        user?: {
          sub: string
          name: string
          email: string
          email_verified: boolean
        }
      }>
      hasExistingEncryptedStore: () => Promise<boolean>
      refreshToken: () => Promise<{
        success: boolean
        tokens?: {
          access_token: string
          id_token: string
          token_type: string
          expires_in: number
          refresh_token?: string
        }
        error?: string
      }>
      willPromptForKeychain: () => Promise<boolean>
      loadFromPersistentStore: () => Promise<{ success: boolean; error?: string }>
      notifyTokensUpdated: () => Promise<void>
    }
    engineAPI: {
      getStatus: () => Promise<EngineStatus>
      getLogs: () => Promise<EngineLog[]>
      clearLogs: () => Promise<{ success: boolean }>
      start: () => Promise<{ success: boolean; error?: string }>
      stop: () => Promise<{ success: boolean; error?: string }>
      restart: () => Promise<{ success: boolean; error?: string }>
      reinstall: () => Promise<{ success: boolean; error?: string }>
      runCommand: (command: string) => Promise<{ success: boolean; error?: string }>
      onStatusChanged: (callback: (event: any, status: EngineStatus) => void) => void
      removeStatusChanged: (callback: (event: any, status: EngineStatus) => void) => void
      onLog: (callback: (event: any, log: EngineLog) => void) => void
      removeLog: (callback: (event: any, log: EngineLog) => void) => void
    }
    editorAPI: {
      requestReloadWebview: () => void
      onReloadWebview: (callback: () => void) => void
      removeReloadWebview: (callback: () => void) => void
    }
    griptapeAPI: {
      getWorkspace: () => Promise<string>
      getDefaultWorkspace: () => Promise<string>
      setWorkspacePreference: (directory: string) => Promise<void>
      setWorkspace: (directory: string) => Promise<{ success: boolean; error?: string }>
      selectDirectory: () => Promise<string | null>
      refreshConfig: () => Promise<void>
      reconfigureEngine: (config: {
        workspaceDirectory: string
        advancedLibrary: boolean
        cloudLibrary: boolean
      }) => Promise<void>
      upgrade: () => Promise<{ success: boolean; error?: string }>
      getVersion: () => Promise<{ success: boolean; version?: string; error?: string }>
      onWorkspaceChanged: (callback: (event: any, directory: string) => void) => void
      removeWorkspaceChanged: (callback: (event: any, directory: string) => void) => void
    }
    electronAPI: {
      getEnvVar: (key: string) => Promise<string | null>
      isPackaged: () => Promise<boolean>
      openExternal: (url: string) => Promise<void>
      getPlatform: () => Promise<NodeJS.Platform>
      restartApp: () => Promise<void>
      setCurrentPage: (page: string) => void
      setFullscreen: (fullscreen: boolean) => Promise<void>
      onNavigateToSettings: (callback: () => void) => void
      removeNavigateToSettings: (callback: () => void) => void
    }
    electron: {
      getPreloadPath: () => string
      getWebviewPreloadPath: () => string
    }
    updateAPI: {
      checkForUpdates: () => Promise<{ success: boolean }>
      isSupported: () => Promise<boolean>
      getPendingUpdate: () => Promise<{ info: any; isReadyToInstall: boolean } | null>
      onDownloadStarted: (callback: (event: any, updateInfo: any) => void) => void
      onDownloadProgress: (callback: (event: any, progress: number) => void) => void
      onDownloadComplete: (callback: () => void) => void
      removeDownloadStarted: (callback: (event: any, updateInfo: any) => void) => void
      removeDownloadProgress: (callback: (event: any, progress: number) => void) => void
      removeDownloadComplete: (callback: () => void) => void
      onDownloadFailed: (
        callback: (event: any, updateInfo: any, errorMessage: string) => void
      ) => void
      removeDownloadFailed: (
        callback: (event: any, updateInfo: any, errorMessage: string) => void
      ) => void
      onUpdateAvailable: (callback: (event: any, updateInfo: any) => void) => void
      removeUpdateAvailable: (callback: (event: any, updateInfo: any) => void) => void
      onUpdateReadyToInstall: (callback: (event: any, updateInfo: any) => void) => void
      removeUpdateReadyToInstall: (callback: (event: any, updateInfo: any) => void) => void
    }
    onboardingAPI: {
      isOnboardingComplete: () => Promise<boolean>
      isCredentialStorageEnabled: () => Promise<boolean>
      setCredentialStoragePreference: (enabled: boolean) => Promise<{ success: boolean }>
      completeOnboarding: (credentialStorageEnabled: boolean) => Promise<{ success: boolean }>
      resetOnboarding: () => Promise<{ success: boolean }>
      enableCredentialStorage: () => Promise<{ success: boolean; error?: string }>
      testEncryption: () => Promise<{ success: boolean; error?: string }>
      isKeychainVerificationSeen: () => Promise<boolean>
      setKeychainVerificationSeen: (seen: boolean) => Promise<{ success: boolean }>
      isWorkspaceSetupComplete: () => Promise<boolean>
      setWorkspaceSetupComplete: (complete: boolean) => Promise<{ success: boolean }>
      isAdvancedLibraryEnabled: () => Promise<boolean>
      setAdvancedLibraryEnabled: (enabled: boolean) => Promise<{ success: boolean }>
      isCloudLibraryEnabled: () => Promise<boolean>
      setCloudLibraryEnabled: (enabled: boolean) => Promise<{ success: boolean }>
    }
    usageMetricsAPI: {
      reportLaunch: () => Promise<{ success: boolean; error?: string }>
    }
    deviceIdAPI: {
      getDeviceId: () => Promise<{ success: boolean; deviceId?: string; error?: string }>
      getDeviceIdInfo: () => Promise<{
        success: boolean
        info?: { deviceId: string; generatedAt: string } | null
      }>
      resetDeviceId: () => Promise<{ success: boolean }>
    }
    settingsAPI: {
      getShowSystemMonitor: () => Promise<boolean>
      setShowSystemMonitor: (show: boolean) => Promise<{ success: boolean }>
      getEngineChannel: () => Promise<'stable' | 'nightly'>
      setEngineChannel: (
        channel: 'stable' | 'nightly'
      ) => Promise<{ success: boolean; error?: string }>
      getAvailableEngineChannels: () => Promise<string[]>
      isChannelSwitchInProgress: () => Promise<boolean>
      getEditorChannel: () => Promise<'stable' | 'nightly' | 'local'>
      setEditorChannel: (
        channel: 'stable' | 'nightly' | 'local'
      ) => Promise<{ success: boolean; error?: string }>
      getUpdateBehavior: () => Promise<UpdateBehavior>
      setUpdateBehavior: (behavior: UpdateBehavior) => Promise<{ success: boolean }>
      getDismissedUpdateVersion: () => Promise<string | null>
      setDismissedUpdateVersion: (version: string | null) => Promise<{ success: boolean }>
      getDismissedEngineUpdateVersion: () => Promise<string | null>
      setDismissedEngineUpdateVersion: (version: string | null) => Promise<{ success: boolean }>
      getEngineUpdateBehavior: () => Promise<UpdateBehavior>
      setEngineUpdateBehavior: (behavior: UpdateBehavior) => Promise<{ success: boolean }>
      getLocalEnginePath: () => Promise<string | null>
      setLocalEnginePath: (path: string | null) => Promise<{ success: boolean; error?: string }>
      selectLocalEnginePath: () => Promise<{
        success: boolean
        path?: string
        canceled?: boolean
        error?: string
      }>
    }
    engineUpdateAPI: {
      checkForUpdate: () => Promise<{
        success: boolean
        currentVersion?: string
        latestVersion?: string | null
        updateAvailable?: boolean
        error?: string
      }>
      performUpdate: () => Promise<{ success: boolean; error?: string }>
      getPendingUpdate: () => Promise<{
        currentVersion: string
        latestVersion: string | null
        updateAvailable: boolean
      } | null>
      onUpdateAvailable: (
        callback: (
          event: any,
          info: { currentVersion: string; latestVersion: string | null; updateAvailable: boolean }
        ) => void
      ) => void
      removeUpdateAvailable: (
        callback: (
          event: any,
          info: { currentVersion: string; latestVersion: string | null; updateAvailable: boolean }
        ) => void
      ) => void
      onUpdateStarted: (callback: (event: any) => void) => void
      removeUpdateStarted: (callback: (event: any) => void) => void
      onUpdateComplete: (callback: (event: any) => void) => void
      removeUpdateComplete: (callback: (event: any) => void) => void
      onUpdateFailed: (callback: (event: any, error: string) => void) => void
      removeUpdateFailed: (callback: (event: any, error: string) => void) => void
    }
    systemMonitorAPI: {
      getMetrics: () => Promise<{
        success: boolean
        metrics?: {
          cpu: {
            usage: number
            model: string
          }
          memory: {
            used: number
            total: number
            percentage: number
            type: 'system' | 'unified'
            breakdown?: {
              used: number
              cached: number
              available: number
              total: number
            }
          }
          gpus: Array<{
            model: string
            usage: number
            memory: {
              used: number
              total: number
            }
          }>
        }
        error?: string
      }>
      startMonitoring: () => Promise<{ success: boolean }>
      stopMonitoring: () => Promise<{ success: boolean }>
      onMetricsUpdate: (callback: (metrics: any) => void) => void
      removeMetricsUpdate: (callback: (metrics: any) => void) => void
    }
    menuAPI: {
      about: () => Promise<void>
      checkForUpdates: () => Promise<void>
      appSettings: () => Promise<void>
      reload: () => Promise<void>
      forceReload: () => Promise<void>
      toggleDevTools: () => Promise<void>
      resetZoom: () => Promise<void>
      zoomIn: () => Promise<void>
      zoomOut: () => Promise<void>
      toggleFullscreen: () => Promise<void>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      isMaximized: () => Promise<boolean>
      close: () => Promise<void>
    }
  }
}

// Webview tag declarations for Electron
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        nodeintegration?: string
        disablewebsecurity?: string
        allowpopups?: string
        allowfullscreen?: string
        preload?: string
      }
    }
  }

  interface HTMLWebViewElement extends HTMLElement {
    src: string
    partition: string
    getWebContents(): Electron.WebContents
    executeJavaScript(code: string): Promise<any>
    reload(): void
    getURL(): string
    openDevTools(): void
    addEventListener<K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ): void
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void
    removeEventListener<K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | EventListenerOptions
    ): void
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void
  }
}

export {}
