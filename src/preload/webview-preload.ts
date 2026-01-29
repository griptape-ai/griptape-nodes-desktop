// Preload script for the editor webview
// This runs in the webview's context before the page loads

import { ipcRenderer } from 'electron'

console.log('[WebviewPreload] Webview preload script loaded')
console.debug('[WebviewPreload] Location:', window.location.href)

// Listen for token updates from the main process and notify the editor
ipcRenderer.on('auth:tokens-updated', (_event, data) => {
  console.log('[WebviewPreload] Received token update from main process')
  // Notify the editor that tokens have been refreshed
  // The editor should listen for this event to update its auth state
  window.postMessage(
    {
      type: 'AUTH_TOKENS_UPDATED',
      token: data.tokens?.access_token || null,
      expiresAt: data.expiresAt || null,
    },
    window.location.origin,
  )
})

// Handle postMessage authentication protocol from embedded editor
window.addEventListener('message', async (event) => {
  // Verify origin is from Griptape editor (production/nightly) or localhost (development)
  const isGriptapeOrigin = event.origin.includes('nodes.griptape.ai')
  const isLocalDevelopment = event.origin.startsWith('http://localhost:')

  if (!isGriptapeOrigin && !isLocalDevelopment) {
    console.warn('[WebviewPreload] Ignoring message from untrusted origin:', event.origin)
    return
  }

  const { type, requestId } = event.data
  if (!type || !requestId) return

  console.debug('[WebviewPreload] Processing request:', type, requestId)

  try {
    switch (type) {
      case 'AUTH_TOKEN_REQUEST': {
        const authData = ipcRenderer.sendSync('webview:auth-token-request')
        console.debug('[WebviewPreload] Sending AUTH_TOKEN_RESPONSE:', {
          hasToken: !!authData?.token,
          error: authData?.error,
        })
        window.postMessage(
          {
            type: 'AUTH_TOKEN_RESPONSE',
            requestId,
            token: authData?.token || null,
            error: authData?.error || null,
          },
          event.origin,
        )
        break
      }

      case 'USER_INFO_REQUEST': {
        const userData = ipcRenderer.sendSync('webview:user-info-request')
        console.debug('[WebviewPreload] Sending USER_INFO_RESPONSE:', {
          hasUser: !!userData?.user,
          error: userData?.error,
        })
        window.postMessage(
          {
            type: 'USER_INFO_RESPONSE',
            requestId,
            user: userData?.user || null,
            error: userData?.error || null,
          },
          event.origin,
        )
        break
      }

      case 'LOGOUT_REQUEST': {
        const result = ipcRenderer.sendSync('webview:logout-request')
        console.debug('[WebviewPreload] Sending LOGOUT_RESPONSE')
        window.postMessage(
          {
            type: 'LOGOUT_RESPONSE',
            requestId,
            success: result?.success || false,
            error: result?.error || null,
          },
          event.origin,
        )
        break
      }
    }
  } catch (err) {
    console.error('[WebviewPreload] Error handling request:', err)
    window.postMessage(
      {
        type: `${type.replace('_REQUEST', '_RESPONSE')}`,
        requestId,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      event.origin,
    )
  }
})

console.log('[WebviewPreload] PostMessage handlers registered')
