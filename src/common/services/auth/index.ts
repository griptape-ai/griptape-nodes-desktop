import { app, BrowserWindow, ipcMain } from 'electron';
import { logger } from '@/logger';

interface OAuthTokens {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface UserInfo {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
}

interface ApiKeyResponse {
  api_key: string;
}

export class OAuthService {
  private authPromiseResolve: ((result: any) => void) | null = null;
  private authPromiseReject: ((error: any) => void) | null = null;

  constructor() {
    // No server setup needed for URL scheme approach
  }

  getRedirectUri(): string {
    // In development, use localhost; in production, use custom URL scheme
    const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;
    return isDevelopment ? 'http://localhost:5173/' : 'gtn://auth/callback';
  }

  async startAuthFlow(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.authPromiseResolve = resolve;
      this.authPromiseReject = reject;

      // // In development, we need to manually check for auth completion
      // if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      //   logger.info('Development mode: Manual auth check will be needed');
      //   // Store a reference to this OAuth flow
      //   const oauthService = this;
        
      //   // Create an IPC handler to manually check for auth completion
      //   ipcMain.handle('check-auth-completion', async () => {
      //     try {
      //       // Fetch the localhost page to get the current URL with auth params
      //       const response = await fetch('http://localhost:5173/');
      //       const text = await response.text();
            
      //       // Check if localStorage has auth data by evaluating JS in a hidden window
      //       const hiddenWindow = new BrowserWindow({
      //         show: false,
      //         webPreferences: {
      //           nodeIntegration: false,
      //           contextIsolation: true
      //         }
      //       });
            
      //       await hiddenWindow.loadURL('http://localhost:5173/');
            
      //       const result = await hiddenWindow.webContents.executeJavaScript(`
      //         localStorage.getItem('oauth_callback_data')
      //       `);
            
      //       hiddenWindow.close();
            
      //       if (result) {
      //         const authData = JSON.parse(result);
      //         logger.info('Found auth data:', authData);
              
      //         // Build URL from auth data and handle it
      //         const params = new URLSearchParams();
      //         if (authData.code) params.set('code', authData.code);
      //         if (authData.state) params.set('state', authData.state);
      //         if (authData.error) params.set('error', authData.error);
      //         if (authData.error_description) params.set('error_description', authData.error_description);
              
      //         const fakeUrl = `http://localhost:5173/?${params.toString()}`;
      //         oauthService.handleUrlCallback(fakeUrl);
              
      //         return { success: true };
      //       }
            
      //       return { success: false, message: 'No auth data found' };
      //     } catch (error) {
      //       logger.error('Error checking auth completion:', error);
      //       return { success: false, error: error.message };
      //     }
      //   });
      // }

      // // Timeout after 5 minutes
      // setTimeout(() => {
      //   if (this.authPromiseResolve) {
      //     this.authPromiseReject?.(new Error('Authentication timeout'));
      //     this.authPromiseResolve = null;
      //     this.authPromiseReject = null;
      //   }
      // }, 5 * 60 * 1000);
    });
  }

  async handleUrlCallback(url: string): Promise<void> {
    try {
      logger.info('Handling URL callback:', url);
      
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');
      const errorDescription = urlObj.searchParams.get('error_description');

      if (error) {
        const errorMessage = errorDescription || error;
        logger.error('OAuth error:', errorMessage);
        this.authPromiseReject?.(new Error(errorMessage));
        return;
      }

      if (!code) {
        logger.error('No authorization code in callback URL');
        this.authPromiseReject?.(new Error('No authorization code received'));
        return;
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token);

      // Generate API key
      const apiKey = await this.generateApiKey(tokens.access_token);

      logger.info('OAuth flow completed successfully');
      this.authPromiseResolve?.({
        success: true,
        tokens,
        user: userInfo,
        apiKey
      });

    } catch (error) {
      logger.error('OAuth callback error:', error);
      this.authPromiseReject?.(error);
    } finally {
      // Clear promise handlers
      this.authPromiseResolve = null;
      this.authPromiseReject = null;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://auth.cloud.griptape.ai/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'bK5Fijuoy90ftmcwVUZABA5THOZyzHnH',
        code,
        redirect_uri: this.getRedirectUri(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async getUserInfo(accessToken: string): Promise<UserInfo> {
    const response = await fetch('https://auth.cloud.griptape.ai/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }

    return response.json();
  }

  private async generateApiKey(accessToken: string): Promise<string> {
    const response = await fetch('https://cloud.griptape.ai/api/engines/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate API key: ${response.statusText}`);
    }

    const data: ApiKeyResponse = await response.json();
    return data.api_key;
  }
}