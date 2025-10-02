// Preload script for the editor webview
// This runs in the webview's context before the page loads

import { ipcRenderer } from 'electron';

console.log('Webview preload script loaded');

// Inject auth before the page's JavaScript runs - MUST be synchronous
try {
  console.log('Attempting to inject auth into webview (synchronous)...');

  // Get auth data synchronously - this blocks until we have the data
  const authData = ipcRenderer.sendSync('auth:check-sync');

  if (!authData.isAuthenticated || !authData.tokens) {
    console.warn('Not authenticated, skipping auth injection');
  } else {
    const { tokens, user } = authData;

    console.log('Got auth tokens in webview preload, expires_in:', tokens.expires_in);

    // Calculate expiration time
    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 86400);

    // Auth0 localStorage key format (must match scope in OAuth request)
    const auth0Key = '@@auth0spajs@@::bK5Fijuoy90ftmcwVUZABA5THOZyzHnH::https://cloud.griptape.ai/api::openid profile email offline_access';

    // Auth0 cache entry format
    const auth0CacheEntry = {
      body: {
        client_id: 'bK5Fijuoy90ftmcwVUZABA5THOZyzHnH',
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token,
        scope: 'openid profile email offline_access',
        expires_in: tokens.expires_in || 86400,
        token_type: tokens.token_type || 'Bearer',
        decodedToken: {
          user: user
        }
      },
      expiresAt
    };

    console.log('Injecting auth with expiresAt:', expiresAt, 'current time:', Math.floor(Date.now() / 1000));

    // Inject into localStorage before page loads - this is synchronous
    localStorage.setItem(auth0Key, JSON.stringify(auth0CacheEntry));

    console.log('✅ Auth injected into webview localStorage via preload (synchronous)');
  }
} catch (err) {
  console.error('Failed to inject auth in webview preload:', err);
}
