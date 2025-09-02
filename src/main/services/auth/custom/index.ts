import { app, BrowserWindow, ipcMain } from 'electron';

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

export class CustomAuthService {
  constructor() {
    // No server setup needed for URL scheme approach
  }


  // // TODO: Do this in some kind of lifecycle hook
  // // Handle URL scheme callback (for when app is already running)
  // app.on('open-url', (event, url) => {
  //   event.preventDefault();
  //   console.log('Received URL:', url);
  //   oauthService.handleUrlCallback(url);
  // });

  // getRedirectUri(): string {
  //   return 'gtn://auth/callback';
  // }

  async start() {}
  async stop() {}
  async login() {}

}