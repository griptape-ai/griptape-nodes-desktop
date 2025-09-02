// Global type declarations for renderer process

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
    electronAPI?: {
      getEnvVar: (key: string) => Promise<string | null>;
      isDevelopment: () => Promise<boolean>;
    };
  }
}

export {};