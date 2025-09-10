import { BrowserWindow, shell } from 'electron';
import express from 'express';
import { Server } from 'http';
import Store from 'electron-store';

const PORT = 5172;
const REDIRECT_URI = `http://localhost:${PORT}/`;

interface AuthData {
  apiKey?: string;
  tokens?: any;
  user?: any;
}

export class HttpAuthService {
  private server: Server | null = null;
  private authResolve: ((value: any) => void) | null = null;
  private authReject: ((reason?: any) => void) | null = null;
  private store: Store<AuthData>;

  constructor() {
    // Initialize secure storage
    this.store = new Store<AuthData>({
      name: 'auth-storage',
      encryptionKey: 'griptape-nodes-auth'
    });
  }

  // Start a local dev server in some kind of lifecycle hook.
  async start() {
    if (this.server) {
      console.log('Auth server already running');
      return;
    }

    const app = express();
    
    // OAuth callback route at root
    app.get('/', (req, res) => {
      const { code, state, error, error_description } = req.query;
      
      // Log the code
      console.log('OAuth callback received - code:', code);
      
      // Simple success message
      res.send(`
        <html>
          <head>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .message {
                text-align: center;
                color: #333;
              }
            </style>
          </head>
          <body>
            <div class="message">
              <h2>✓ Success</h2>
              <p>Authentication complete!</p>
              <p style="color: #666;">You can close this tab and return to Griptape Nodes.</p>
            </div>
          </body>
        </html>
      `);
      
      // Send to renderer via IPC and focus the app
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('auth:callback', {
          code,
          state,
          error,
          error_description
        });
        
        // Focus the app window
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
      
      // Handle internally
      if (code) {
        this.handleAuthCode(code as string, state as string);
      } else if (error) {
        this.authReject?.(new Error(error_description as string || error as string));
      }
    });

    // Start server
    return new Promise<void>((resolve, reject) => {
      this.server = app.listen(PORT, () => {
        console.log(`Auth server listening on http://localhost:${PORT}`);
        resolve();
      }).on('error', reject);
    });
  }

  async stop() {
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          console.log('Auth server stopped');
          this.server = null;
          resolve();
        });
      });
    }
  }


  // Check if we have stored credentials
  hasStoredCredentials(): boolean {
    return !!this.store.get('apiKey');
  }

  // Get stored credentials
  getStoredCredentials(): AuthData | null {
    const apiKey = this.store.get('apiKey');
    const tokens = this.store.get('tokens');
    const user = this.store.get('user');
    
    // Only return if we have complete credentials
    if (!apiKey || !tokens || !user) return null;
    
    return {
      apiKey,
      tokens,
      user
    };
  }

  // Clear stored credentials (but keep API key)
  clearCredentials(): void {
    // Keep the API key but clear user session
    const apiKey = this.store.get('apiKey');
    this.store.clear();
    if (apiKey) {
      this.store.set('apiKey', apiKey);
    }
  }

  async login(): Promise<any> {
    // Check if we have complete credentials
    const stored = this.getStoredCredentials();
    if (stored) {
      console.log('Using stored credentials');
      return {
        success: true,
        ...stored
      };
    }
    
    console.log('No complete credentials, starting OAuth flow');

    return new Promise((resolve, reject) => {
      this.authResolve = resolve;
      this.authReject = reject;

      const state = Math.random().toString(36).substring(7);
      shell.openExternal(`https://auth.cloud.griptape.ai/authorize?` +
        `response_type=code&` +
        `client_id=bK5Fijuoy90ftmcwVUZABA5THOZyzHnH&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `audience=${encodeURIComponent('https://cloud.griptape.ai/api')}&` +
        `state=${state}&` +
        `scope=openid%20profile%20email`);

      // Set timeout
      setTimeout(() => {
        if (this.authResolve) {
          this.authReject?.(new Error('Authentication timeout'));
          this.authResolve = null;
          this.authReject = null;
        }
      }, 5 * 60 * 1000); // 5 minutes
    });
  }

  private async handleAuthCode(code: string, state: string) {
    try {
      console.log('Handling auth code:', code, 'state:', state);
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      console.log('Got tokens:', tokens);
      
      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token);
      console.log('Got user info:', userInfo);
      
      // Check if we already have an API key, only generate if needed
      let apiKey = this.store.get('apiKey');
      if (!apiKey) {
        apiKey = await this.generateApiKey(tokens.access_token);
        console.log('Generated new API key:', apiKey);
        this.store.set('apiKey', apiKey);
      } else {
        console.log('Using existing API key');
      }
      
      // Store credentials
      this.store.set('tokens', tokens);
      this.store.set('user', userInfo);
      console.log('Credentials stored successfully');
      
      // Resolve the auth promise if it exists
      this.authResolve?.({
        success: true,
        tokens,
        user: userInfo,
        apiKey
      });
    } catch (error) {
      console.error('Error handling auth code:', error);
      this.authReject?.(error);
    } finally {
      this.authResolve = null;
      this.authReject = null;
    }
  }

  private async exchangeCodeForTokens(code: string) {
    const response = await fetch('https://auth.cloud.griptape.ai/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'bK5Fijuoy90ftmcwVUZABA5THOZyzHnH',
        code,
        redirect_uri: REDIRECT_URI,
        audience: 'https://cloud.griptape.ai/api'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  private async getUserInfo(accessToken: string) {
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

  private async generateApiKey(accessToken: string) {
    const response = await fetch('https://api.nodes.griptape.ai/api/engines/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`Failed to generate API key: ${response.statusText}`);
    }

    const data = await response.json();
    return data.api_key;
  }
}