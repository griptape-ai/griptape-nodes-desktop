// Global type declarations for renderer process

export interface EngineLog {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
}

export type EngineStatus = 'not-ready' | 'ready' | 'running' | 'initializing' | 'error';

export interface SystemMetrics {
  cpu: {
    usage: number; // CPU usage percentage
    temperature?: number; // CPU temperature in Celsius (if available)
  };
  memory: {
    total: number; // Total system memory in bytes
    used: number; // Used memory in bytes
    free: number; // Free memory in bytes
    usage: number; // Memory usage percentage
  };
  gpu: {
    controllers: Array<{
      vendor: string;
      model: string;
      vram?: number; // VRAM in MB (if available)
      memoryUsed?: number; // VRAM used in MB (if available)
      memoryFree?: number; // VRAM free in MB (if available)
      usage?: number; // GPU usage percentage (if available)
    }>;
  };
  timestamp: Date;
}

declare global {
  interface Window {
    pythonAPI: {
      getPythonInfo: () => Promise<{
        success: boolean;
        version?: string;
        executable?: string;
        versionOutput?: string;
        pathOutput?: string;
        griptapeNodesPath?: string;
        griptapeNodesVersion?: string;
        error?: string;
      }>;
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
    };
    metricsAPI: {
      getLatest: () => Promise<SystemMetrics | null>;
      getHistory: () => Promise<SystemMetrics[]>;
      getRecent: (count: number) => Promise<SystemMetrics[]>;
      getStats: () => Promise<{ count: number; maxSize: number; memoryUsageMB: number }>;
      clearHistory: () => Promise<{ success: boolean }>;
      onMetricsUpdate: (callback: (event: any, metrics: SystemMetrics) => void) => void;
      removeMetricsUpdate: (callback: (event: any, metrics: SystemMetrics) => void) => void;
      onMetricsError: (callback: (event: any, error: string) => void) => void;
      removeMetricsError: (callback: (event: any, error: string) => void) => void;
    };
    electronAPI?: {
      getEnvVar: (key: string) => Promise<string | null>;
      isDevelopment: () => Promise<boolean>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}

export {};