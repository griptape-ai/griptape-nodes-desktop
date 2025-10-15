import { Server } from 'http'
import { EventEmitter } from 'node:events'
import { BrowserWindow, shell, app } from 'electron'
import express from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@/main/utils/logger'
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
  loadFromPersistentStore(): void {
    if (this.store instanceof PersistentStore) {
      logger.info('HttpAuthService: Store already persistent')
      return
    }

    if (!this.hasExistingEncryptedStore()) {
      logger.info('HttpAuthService: No existing encrypted store found')
      return
    }

    logger.info('HttpAuthService: Loading from persistent store')

    // Replace in-memory store with persistent store
    this.store = new PersistentStore<AuthData>('auth-credentials', true)

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

      // Log the code
      logger.info('OAuth callback received - code:', code)

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
      `)

      // Send to renderer via IPC and focus the app
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        // Focus the app window
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
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
        .listen(PORT, () => {
          logger.info(`Auth server listening on http://localhost:${PORT}`)
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

  // Refresh access token using refresh token
  async refreshTokens(
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

  async login(): Promise<void> {
    // Check if we have complete credentials
    const stored = this.getStoredCredentials()
    if (stored) {
      logger.info('Using stored credentials')
      return
    }

    return new Promise((resolve, reject) => {
      this.authResolve = resolve
      this.authReject = reject

      const state = Math.random().toString(36).substring(7)
      const url =
        `https://auth.cloud.griptape.ai/authorize?` +
        `response_type=code&` +
        `client_id=bK5Fijuoy90ftmcwVUZABA5THOZyzHnH&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `audience=${encodeURIComponent('https://cloud.griptape.ai/api')}&` +
        `state=${state}&` +
        `scope=openid%20profile%20email%20offline_access`
      shell.openExternal(url)

      // Set timeout
      setTimeout(
        () => {
          if (this.authResolve) {
            this.authReject?.(new Error('Authentication timeout'))
            this.authResolve = null
            this.authReject = null
          }
        },
        5 * 60 * 1000
      ) // 5 minutes
    })
  }

  private async handleAuthCode(code: string, state: string) {
    try {
      logger.info('Handling auth code:', code, 'state:', state)

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code)
      logger.info('Got tokens:', tokens)

      // Calculate expiration timestamp
      const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 86400)

      // Get user info
      const userInfo = await this.getUserInfo(tokens.access_token)
      logger.info('Got user info:', userInfo)

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
