// Global type declarations for renderer process

export interface EngineLog {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
}

export type EngineStatus = 'not-ready' | 'ready' | 'running' | 'initializing' | 'error';

declare global {
  interface Window {
    pythonAPI: {
      getEnvironmentInfo: () => Promise<{
        success: boolean;
        data?: {
          python: {
            version: string;
            executable: string;
            systemPath: string[];
            installedPackages?: string[];
          };
          griptapeNodes: {
            path: string;
            version: string;
            installed: boolean;
          };
          uv: {
            version: string;
            toolDir: string;
            pythonInstallDir: string;
          };
          system: {
            platform: string;
            arch: string;
            nodeVersion: string;
            electronVersion: string;
          };
          collectedAt: string;
          errors: string[];
        };
        error?: string;
      }>;
    };
    oauthAPI: {
      login: () => Promise<{
        success: boolean;
        tokens?: {
          access_token: string;
          id_token: string;
          token_type: string;
          expires_in: number;
        };
        user?: {
          sub: string;
          name: string;
          email: string;
          email_verified: boolean;
        };
        apiKey?: string;
        error?: string;
      }>;
      logout: () => Promise<{
        success: boolean;
      }>;
      checkAuth: () => Promise<{
        isAuthenticated: boolean;
        apiKey?: string;
        expiresAt?: number;
        tokens?: {
          access_token: string;
          id_token: string;
          token_type: string;
          expires_in: number;
          refresh_token?: string;
        };
        user?: {
          sub: string;
          name: string;
          email: string;
          email_verified: boolean;
        };
      }>;
      refreshToken: (refreshToken: string) => Promise<{
        success: boolean;
        tokens?: {
          access_token: string;
          id_token: string;
          token_type: string;
          expires_in: number;
          refresh_token?: string;
        };
        error?: string;
      }>;
    };
    engineAPI: {
      getStatus: () => Promise<EngineStatus>;
      getLogs: () => Promise<EngineLog[]>;
      clearLogs: () => Promise<{ success: boolean }>;
      start: () => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean; error?: string }>;
      restart: () => Promise<{ success: boolean; error?: string }>;
      onStatusChanged: (callback: (event: any, status: EngineStatus) => void) => void;
      removeStatusChanged: (callback: (event: any, status: EngineStatus) => void) => void;
      onLog: (callback: (event: any, log: EngineLog) => void) => void;
      removeLog: (callback: (event: any, log: EngineLog) => void) => void;
    };
    griptapeAPI: {
      getWorkspace: () => Promise<string>;
      setWorkspace: (directory: string) => Promise<{ success: boolean; error?: string }>;
      selectDirectory: () => Promise<string | null>;
      refreshConfig: () => Promise<void>;
      onWorkspaceChanged: (callback: (event: any, directory: string) => void) => void;
      removeWorkspaceChanged: (callback: (event: any, directory: string) => void) => void;
    };
    electronAPI: {
      getEnvVar: (key: string) => Promise<string | null>;
      isPackaged: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
    };
    electron: {
      getPreloadPath: () => string;
      getWebviewPreloadPath: () => string;
    };
    updateAPI: {
      checkForUpdates: () => Promise<{ success: boolean }>;
      isSupported: () => Promise<boolean>;
      onDownloadStarted: (callback: () => void) => void;
      onDownloadProgress: (callback: (event: any, progress: number) => void) => void;
      onDownloadComplete: (callback: () => void) => void;
      removeDownloadStarted: (callback: () => void) => void;
      removeDownloadProgress: (callback: (event: any, progress: number) => void) => void;
      removeDownloadComplete: (callback: () => void) => void;
    };
  }
}

// Webview tag declarations for Electron
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        partition?: string;
        nodeintegration?: string;
        disablewebsecurity?: string;
        allowpopups?: string;
        preload?: string;
      };
    }
  }

  interface HTMLWebViewElement extends HTMLElement {
    src: string;
    partition: string;
    getWebContents(): Electron.WebContents;
    executeJavaScript(code: string): Promise<any>;
    addEventListener<K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ): void;
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ): void;
    removeEventListener<K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | EventListenerOptions
    ): void;
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ): void;
  }
}

export { };
