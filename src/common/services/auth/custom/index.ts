import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';

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

interface AuthData {
  apiKey?: string;
  tokens?: any;
  user?: any;
}

export class CustomAuthService {
  private store: Store<AuthData>;

  constructor() {
    // Initialize secure storage
    this.store = new Store<AuthData>({
      name: 'auth-storage',
      encryptionKey: 'griptape-nodes-auth'
    });
  }


  // // TODO: Do this in some kind of lifecycle hook
  // // Handle URL scheme callback (for when app is already running)
  // app.on('open-url', (event, url) => {
  //   event.preventDefault();
  //   logger.info('Received URL:', url);
  //   oauthService.handleUrlCallback(url);
  // });

  // getRedirectUri(): string {
  //   return 'gtn://auth/callback';
  // }

  async start() {}
  async stop() {}
  async login() {
    // TODO: Implement custom URL scheme OAuth flow
    throw new Error('Custom OAuth not yet implemented');
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

}