// Global type declarations for renderer process

export interface EngineLog {
  timestamp: Date
  type: 'stdout' | 'stderr'
  message: string
}

export type EngineStatus = 'not-ready' | 'ready' | 'running' | 'initializing' | 'error'

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
      refreshToken: (refreshToken: string) => Promise<{
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
      loadFromPersistentStore: () => Promise<{ success: boolean }>
    }
    engineAPI: {
      getStatus: () => Promise<EngineStatus>
      getLogs: () => Promise<EngineLog[]>
      clearLogs: () => Promise<{ success: boolean }>
      start: () => Promise<{ success: boolean; error?: string }>
      stop: () => Promise<{ success: boolean; error?: string }>
      restart: () => Promise<{ success: boolean; error?: string }>
      onStatusChanged: (callback: (event: any, status: EngineStatus) => void) => void
      removeStatusChanged: (callback: (event: any, status: EngineStatus) => void) => void
      onLog: (callback: (event: any, log: EngineLog) => void) => void
      removeLog: (callback: (event: any, log: EngineLog) => void) => void
    }
    griptapeAPI: {
      getWorkspace: () => Promise<string>
      getDefaultWorkspace: () => Promise<string>
      setWorkspacePreference: (directory: string) => Promise<void>
      setWorkspace: (directory: string) => Promise<{ success: boolean; error?: string }>
      selectDirectory: () => Promise<string | null>
      refreshConfig: () => Promise<void>
      upgrade: () => Promise<{ success: boolean; error?: string }>
      getVersion: () => Promise<{ success: boolean; version?: string; error?: string }>
      checkForEngineUpdate: () => Promise<{
        success: boolean
        currentVersion?: string
        latestVersion?: string | null
        updateAvailable?: boolean
        error?: string
      }>
      onWorkspaceChanged: (callback: (event: any, directory: string) => void) => void
      removeWorkspaceChanged: (callback: (event: any, directory: string) => void) => void
    }
    electronAPI: {
      getEnvVar: (key: string) => Promise<string | null>
      isPackaged: () => Promise<boolean>
      openExternal: (url: string) => Promise<void>
      getPlatform: () => Promise<NodeJS.Platform>
      restartApp: () => Promise<void>
    }
    electron: {
      getPreloadPath: () => string
      getWebviewPreloadPath: () => string
    }
    updateAPI: {
      checkForUpdates: () => Promise<{ success: boolean }>
      isSupported: () => Promise<boolean>
      onDownloadStarted: (callback: () => void) => void
      onDownloadProgress: (callback: (event: any, progress: number) => void) => void
      onDownloadComplete: (callback: () => void) => void
      removeDownloadStarted: (callback: () => void) => void
      removeDownloadProgress: (callback: (event: any, progress: number) => void) => void
      removeDownloadComplete: (callback: () => void) => void
    }
    onboardingAPI: {
      isOnboardingComplete: () => Promise<boolean>
      isCredentialStorageEnabled: () => Promise<boolean>
      setCredentialStoragePreference: (enabled: boolean) => Promise<{ success: boolean }>
      completeOnboarding: (credentialStorageEnabled: boolean) => Promise<{ success: boolean }>
      resetOnboarding: () => Promise<{ success: boolean }>
      enableCredentialStorage: () => Promise<{ success: boolean }>
      testEncryption: () => Promise<{ success: boolean; error?: string }>
      isKeychainVerificationSeen: () => Promise<boolean>
      setKeychainVerificationSeen: (seen: boolean) => Promise<{ success: boolean }>
      isWorkspaceSetupComplete: () => Promise<boolean>
      setWorkspaceSetupComplete: (complete: boolean) => Promise<{ success: boolean }>
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
