import { logger } from '@/main/utils/logger'
import { BrowserWindow, app, shell } from 'electron'
import express from 'express'
import * as fs from 'fs'
import { Server } from 'http'
import { EventEmitter } from 'node:events'
import * as path from 'path'
import { Store } from '../stores/base-store'
import { InMemoryStore } from '../stores/in-memory-store'
import { PersistentStore } from '../stores/persistent-store'

const PORT = 5172
const REDIRECT_URI = `http://localhost:${PORT}/`

interface AuthData {
  apiKey?: string
  tokens?: any
  user?: any
  expiresAt?: number
}

interface HttpAuthServiceEvents {
  ready: []
  apiKey: [string]
}

export class HttpAuthService extends EventEmitter<HttpAuthServiceEvents> {
  private server: Server | null = null
  private authResolve: ((value: any) => void) | null = null
  private authReject: ((reason?: any) => void) | null = null
  private store: Store<AuthData>
  // Mutex to prevent concurrent token refresh attempts (prevents "reused refresh token" errors)
  private refreshPromise: Promise<{ success: boolean; tokens?: any; error?: string }> | null = null

  constructor() {
    super()
    // Start with in-memory storage
    this.store = new InMemoryStore<AuthData>()
  }

  // Check if encrypted store file already exists (indicates prior keychain access)
  hasExistingEncryptedStore(): boolean {
    try {
      const storePath = path.join(app.getPath('userData'), 'auth-credentials.json')
      return fs.existsSync(storePath)
    } catch (error) {
      logger.error('Failed to check for existing store:', error)
      return false
    }
  }

  // Load credentials from existing persistent store (triggers keychain access on macOS)
  // This should be called on app start if credential storage was previously enabled
  loadFromPersistentStore(): { success: boolean; error?: string } {
    if (this.store instanceof PersistentStore) {
      logger.info('HttpAuthService: Store already persistent')
      return { success: true }
    }

    if (!this.hasExistingEncryptedStore()) {
      logger.info('HttpAuthService: No existing encrypted store found')
      return { success: false, error: 'No encrypted store found' }
    }

    logger.info('HttpAuthService: Loading from persistent store')

    try {
      // Replace in-memory store with persistent store
      this.store = new PersistentStore<AuthData>('auth-credentials', true)

      // Set up event listeners for the persistent store
      ;(this.store as PersistentStore<AuthData>).on('change:apiKey', (apiKey: string) => {
        this.emit('apiKey', apiKey)
      })

      // Try to read and decrypt the API key to verify keychain/DPAPI access works
      // This will throw if decryption fails (e.g., keychain access denied)
      const apiKey = this.store.get('apiKey')
      if (apiKey && typeof apiKey === 'string') {
        this.emit('apiKey', apiKey)
      }

      return { success: true }
    } catch (error) {
      logger.error('HttpAuthService: Failed to load from persistent store:', error)
      // Revert to in-memory store on error
      this.store = new InMemoryStore<AuthData>()
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  // Enable persistence and initialize encrypted store (triggers keychain access on macOS)
  // This should be called after user opts in during onboarding
  enablePersistence(): void {
    if (this.store instanceof PersistentStore) {
      logger.info('HttpAuthService: Store already persistent')
      return
    }

    logger.info('HttpAuthService: Enabling persistence')

    // Convert in-memory store to persistent store
    this.store = (this.store as InMemoryStore<AuthData>).toPersistent('auth-credentials', true)

    // Set up event listeners for the persistent store
    ;(this.store as PersistentStore<AuthData>).on('change:apiKey', (apiKey: string) => {
      this.emit('apiKey', apiKey)
    })

    // Propagate the initial state
    const apiKey = this.store.get('apiKey')
    if (apiKey && typeof apiKey === 'string') {
      this.emit('apiKey', apiKey)
    }
  }

  // Start a local dev server in some kind of lifecycle hook.
  async start() {
    // Note: We intentionally do NOT auto-load from persistent store here.
    // The renderer's AuthContext will call loadFromPersistentStore() if:
    // 1. The user has enabled credential storage (credentialStorageEnabled)
    // 2. An encrypted store file exists
    // This ensures we respect the user's preference and don't trigger
    // unexpected keychain prompts on macOS.

    // Propagate the initial state for in-memory store
    if (this.store instanceof InMemoryStore) {
      const apiKey = this.store.get('apiKey')
      if (apiKey) {
        this.emit('apiKey', apiKey)
      }
    }

    if (this.server) {
      logger.info('Auth server already running')
      return
    }

    const app = express()

    // OAuth callback route at root
    app.get('/', (req, res) => {
      const { code, state, error, error_description } = req.query

      logger.debug('OAuth callback received')

      // Determine if authentication was successful
      const isSuccess = !!code && !error

      // Send HTML response with auto-close functionality
      res.send(`
        <html>
          <head>
            <title>Griptape Nodes - Authentication</title>
            <style>
              body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                text-align: center;
                max-width: 400px;
              }
              .icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
              h1 {
                margin: 0 0 0.5rem 0;
                color: #333;
                font-size: 1.75rem;
              }
              p {
                color: #666;
                margin: 0.5rem 0;
                line-height: 1.6;
              }
              .countdown {
                margin-top: 1.5rem;
                padding: 1rem;
                background: #f5f5f5;
                border-radius: 0.5rem;
                color: #666;
                font-size: 0.9rem;
              }
              .error {
                color: #e53e3e;
              }
            </style>
          </head>
          <body>
            <div class="container">
              ${
                isSuccess
                  ? `
                <div class="icon">✓</div>
                <h1>Authentication Successful!</h1>
                <p>You have successfully logged in to Griptape Nodes.</p>
                <div class="countdown">
                  <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">✨ <strong>You're all set!</strong></p>
                  <p style="margin-top: 0.75rem;">Return to the Griptape Nodes app to continue.</p>
                  <p style="font-size: 0.85rem; margin-top: 1rem; color: #999;">You can safely close this tab.</p>
                </div>
              `
                  : `
                <div class="icon error">✗</div>
                <h1>Authentication Failed</h1>
                <p class="error">${error_description || error || 'An unknown error occurred'}</p>
                <p style="margin-top: 1rem;">Please close this tab and try again in the app.</p>
              `
              }
            </div>
          </body>
        </html>
      `)

      // Focus the app window
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        mainWindow.show()
      }

      // Handle internally
      if (code) {
        this.handleAuthCode(code as string, state as string)
      } else if (error) {
        this.authReject?.(new Error((error_description as string) || (error as string)))
      }
    })

    // Start server
    return new Promise<void>((resolve, reject) => {
      this.server = app
        .listen(PORT, async () => {
          logger.info(`Auth server listening on http://localhost:${PORT}`)

          // Attempt silent login with stored credentials after server is ready
          try {
            await this.attemptSilentLogin()
          } catch (error) {
            logger.error('Error during silent login attempt:', error)
          }

          resolve()
        })
        .on('error', reject)
    })
  }

  async stop() {
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          logger.info('Auth server stopped')
          this.server = null
          resolve()
        })
      })
    }
  }

  async waitForApiKey(): Promise<string> {
    const apiKey = this.store.get('apiKey')
    if (apiKey) {
      return Promise.resolve(apiKey)
    }
    return new Promise((resolve) => this.once('apiKey', (apiKey) => resolve(apiKey)))
  }

  // Check if we have stored credentials
  hasStoredCredentials(): boolean {
    const apiKey = this.store.get('apiKey')
    const tokens = this.store.get('tokens')
    const user = this.store.get('user')

    // Only return if we have complete credentials
    return !!(apiKey && tokens && user)
  }

  // Get stored credentials
  getStoredCredentials(): AuthData | null {
    const apiKey = this.store.get('apiKey')
    const tokens = this.store.get('tokens')
    const user = this.store.get('user')
    const expiresAt = this.store.get('expiresAt')

    // Only return if we have complete credentials
    if (!apiKey || !tokens || !user) return null

    return {
      apiKey,
      tokens,
      user,
      expiresAt
    }
  }

  // Clear all credentials and delete encrypted store if it exists
  clearCredentials(): void {
    logger.info('HttpAuthService: Clearing credentials')

    if (this.store instanceof PersistentStore) {
      // Delete the encrypted store file and revert to in-memory storage
      try {
        ;(this.store as PersistentStore<AuthData>).deleteStore()
        logger.info('HttpAuthService: Deleted encrypted store, reverting to in-memory storage')
      } catch (error) {
        logger.error('HttpAuthService: Failed to delete encrypted store:', error)
      }

      // Replace with fresh in-memory store
      this.store = new InMemoryStore<AuthData>()
    } else {
      // Just clear in-memory store
      this.store.clear()
    }
  }

  // Check if stored tokens are expired (with 5 minute buffer for safety)
  private isTokenExpired(expiresAt?: number): boolean {
    if (!expiresAt) return true
    const now = Math.floor(Date.now() / 1000)
    return expiresAt - now < 300 // Refresh if less than 5 minutes remaining
  }

  // Attempt to silently authenticate using stored credentials
  // Returns true if authenticated (credentials valid or refreshed), false if login required
  async attemptSilentLogin(): Promise<boolean> {
    const stored = this.getStoredCredentials()

    if (!stored) {
      logger.info('No stored credentials for silent login')
      return false
    }

    // Check if tokens are still valid
    if (!this.isTokenExpired(stored.expiresAt)) {
      logger.info('Silent login successful - credentials still valid')
      return true
    }

    // Tokens expired, try to refresh using the mutex-protected method
    // This prevents concurrent refresh attempts from both startup and renderer
    if (stored.tokens?.refresh_token) {
      logger.info(
        '[attemptSilentLogin] Tokens expired, requesting refresh via attemptTokenRefresh()...'
      )
      const refreshResult = await this.attemptTokenRefresh()

      if (refreshResult.success) {
        logger.info('Silent login successful - tokens refreshed')
        return true
      }

      logger.warn('Silent token refresh failed:', refreshResult.error)
      this.clearCredentials()
      return false
    }

    logger.warn('No refresh token available for silent login')
    this.clearCredentials()
    return false
  }

  // Internal method to refresh tokens - should not be called directly from outside
  // Use attemptTokenRefresh() instead which handles mutex and uses stored token
  private async refreshTokensInternal(
    refreshToken: string
  ): Promise<{ success: boolean; tokens?: any; error?: string }> {
    try {
      logger.info('Attempting to refresh tokens...')

      const response = await fetch('https://auth.cloud.griptape.ai/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: 'bK5Fijuoy90ftmcwVUZABA5THOZyzHnH',
          refresh_token: refreshToken
        })
      })

      if (!response.ok) {
        const error = await response.text()
        logger.error(`Token refresh failed: ${response.statusText} - ${error}`)
        return {
          success: false,
          error: `Token refresh failed: ${response.statusText}`
        }
      }

      const tokens = (await response.json()) as any
      if (!tokens?.access_token) {
        return {
          success: false,
          error: 'Expected access_token in response'
        }
      }

      // Calculate new expiration timestamp
      const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 86400)

      // Update stored tokens with new values
      this.store.set('tokens', tokens)
      this.store.set('expiresAt', expiresAt)

      logger.info('Tokens refreshed successfully')

      return {
        success: true,
        tokens
      }
    } catch (error) {
      logger.error('Error refreshing tokens:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Public method to attempt token refresh using stored credentials
  // Uses mutex to prevent concurrent refresh attempts (which cause "reused refresh token" errors)
  async attemptTokenRefresh(): Promise<{ success: boolean; tokens?: any; error?: string }> {
    // If a refresh is already in progress, return the existing promise
    // This prevents concurrent refresh attempts from using the same token
    if (this.refreshPromise) {
      logger.info(
        '[attemptTokenRefresh] Refresh already in progress, waiting for existing request (mutex active)...'
      )
      return this.refreshPromise
    }

    logger.info('[attemptTokenRefresh] Starting new token refresh (no existing request)')

    // Get stored credentials - use the token from store (single source of truth)
    const stored = this.getStoredCredentials()
    if (!stored?.tokens?.refresh_token) {
      logger.warn('No refresh token available in store')
      return {
        success: false,
        error: 'No refresh token available'
      }
    }

    // Check if tokens are still valid (no need to refresh)
    if (!this.isTokenExpired(stored.expiresAt)) {
      logger.info('Tokens still valid, no refresh needed')
      return {
        success: true,
        tokens: stored.tokens
      }
    }

    // Create the refresh promise and store it (mutex)
    this.refreshPromise = this.refreshTokensInternal(stored.tokens.refresh_token).finally(() => {
      // Clear the promise when done (success or failure)
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  async login(): Promise<{ success: boolean; tokens?: any; user?: any; apiKey?: string }> {
    // Try silent login first
    const silentLoginSuccessful = await this.attemptSilentLogin()
    if (silentLoginSuccessful) {
      logger.info('Login successful via stored credentials')
      const stored = this.getStoredCredentials()
      return {
        success: true,
        tokens: stored?.tokens,
        user: stored?.user,
        apiKey: stored?.apiKey
      }
    }

    // If silent login failed, proceed with browser-based OAuth flow
    logger.info('No valid stored credentials, prompting for browser login')

    return new Promise((resolve, reject) => {
      this.authResolve = resolve
      this.authReject = reject

      const state = Math.random().toString(36).substring(7)
      const authUrl =
        `https://auth.cloud.griptape.ai/authorize?` +
        `response_type=code&` +
        `client_id=bK5Fijuoy90ftmcwVUZABA5THOZyzHnH&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `audience=${encodeURIComponent('https://cloud.griptape.ai/api')}&` +
        `state=${state}&` +
        `scope=openid%20profile%20email%20offline_access`

      logger.info('Opening authentication URL in system browser')

      // Open the auth URL in the user's default browser
      shell.openExternal(authUrl).catch((error) => {
        logger.error('Failed to open browser:', error)
        this.authReject?.(new Error('Failed to open browser for authentication'))
        this.authResolve = null
        this.authReject = null
      })

      // Set timeout for authentication (5 minutes)
      setTimeout(
        () => {
          if (this.authResolve) {
            logger.warn('Authentication timeout - no callback received')
            this.authReject?.(new Error('Authentication timeout'))
            this.authResolve = null
            this.authReject = null
          }
        },
        5 * 60 * 1000
      )
    })
  }

  cancelLogin(): void {
    logger.info('Cancelling authentication')
    if (this.authResolve) {
      this.authReject?.(new Error('Authentication cancelled'))
      this.authResolve = null
      this.authReject = null
    }
  }

  private async handleAuthCode(code: string, _state: string) {
    try {
      logger.debug('Handling auth code exchange')

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code)
      logger.debug('Tokens received')

      // Calculate expiration timestamp
      const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 86400)

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token)
      logger.debug('User info retrieved')

      // Check if we already have an API key, only generate if needed
      let apiKey = this.store.get('apiKey')
      if (!apiKey) {
        apiKey = await this.generateApiKey(tokens.access_token)
        this.store.set('apiKey', apiKey)
      }

      // Store credentials with expiration timestamp
      this.store.set('tokens', tokens)
      this.store.set('expiresAt', expiresAt)
      this.store.set('user', userInfo)

      // Emit the apiKey event to unblock waitForApiKey() regardless of storage type
      this.emit('apiKey', apiKey)

      // Resolve the auth promise if it exists
      this.authResolve?.({
        success: true,
        tokens,
        user: userInfo,
        apiKey
      })
    } catch (error) {
      logger.error('Error handling auth code:', error)
      this.authReject?.(error)
    } finally {
      this.authResolve = null
      this.authReject = null
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string
    id_token: string
    token_type: string
    expires_in: number
    refresh_token?: string
  }> {
    const response = await fetch('https://auth.cloud.griptape.ai/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'bK5Fijuoy90ftmcwVUZABA5THOZyzHnH',
        code,
        redirect_uri: REDIRECT_URI,
        audience: 'https://cloud.griptape.ai/api'
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Token exchange failed: ${response.statusText} - ${error}`)
    }

    const tokens = (await response.json()) as any
    if (!tokens?.access_token) {
      throw new Error('Expected access_token in response')
    }

    return tokens
  }

  private async getUserInfo(accessToken: string) {
    const response = await fetch('https://auth.cloud.griptape.ai/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`)
    }

    return response.json()
  }

  private async generateApiKey(accessToken: string): Promise<string> {
    const response = await fetch('https://api.nodes.griptape.ai/api/engines/token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`Failed to generate API key: ${response.statusText}`)
    }

    const data = (await response.json()) as any
    if (!data?.api_key) {
      throw new Error('Expected api_key in response')
    }

    return data.api_key
  }
}
