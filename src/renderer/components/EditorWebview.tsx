import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface EditorWebviewProps {
  isVisible: boolean
  navigateTo?: { path: string; timestamp: number } | null
  openWorkflowModal?: { timestamp: number } | null
}

export const EditorWebview: React.FC<EditorWebviewProps> = ({
  isVisible,
  navigateTo,
  openWorkflowModal
}) => {
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [isWebviewReady, setIsWebviewReady] = useState(false)
  const [preloadPath, setPreloadPath] = useState<string | null>(null)
  const [editorUrl, setEditorUrl] = useState<string | null>(null)
  const [hasEverBeenVisible, setHasEverBeenVisible] = useState(false)
  const webviewRef = useRef<HTMLWebViewElement>(null)
  // Track navigation in a ref so initialization can read it without re-running
  const navigationRef = useRef(navigateTo)
  navigationRef.current = navigateTo
  // Track the last navigated timestamp to avoid duplicate navigation
  const lastNavigatedTimestamp = useRef<number | null>(null)
  // Track the last workflow modal open timestamp to avoid duplicate triggers
  const lastWorkflowModalTimestamp = useRef<number | null>(null)

  // Use AuthContext instead of checking independently
  const { isLoading, isAuthenticated, tokens } = useAuth()

  // Track when editor becomes visible for the first time
  useEffect(() => {
    if (isVisible && !hasEverBeenVisible) {
      console.log('[EditorWebview] Editor tab opened for first time, starting load')
      setHasEverBeenVisible(true)
    }
  }, [isVisible, hasEverBeenVisible])

  // Get the webview preload path and editor URL only after auth is ready AND editor has been visited
  useEffect(() => {
    if (!hasEverBeenVisible) {
      console.debug('[EditorWebview] Editor not yet visited, deferring load')
      return
    }

    if (isLoading || !isAuthenticated || !tokens) {
      console.debug('[EditorWebview] Waiting for auth...', {
        isLoading,
        isAuthenticated,
        hasTokens: !!tokens
      })
      return
    }

    const loadEditorConfig = async () => {
      try {
        console.debug('[EditorWebview] Auth ready, loading editor config...')
        const path = window.electron.getWebviewPreloadPath()
        console.debug('[EditorWebview] Got webview preload path:', path)
        setPreloadPath(path)

        // Get the configured editor channel
        const channel = await window.settingsAPI.getEditorChannel()
        let baseUrl = 'https://app.nodes.griptape.ai' // default to stable
        switch (channel) {
          case 'nightly':
            baseUrl = 'https://app-nightly.nodes.griptape.ai'
            console.debug('[EditorWebview] Using nightly channel')
            break
          case 'local':
            baseUrl = 'http://localhost:5173'
            console.debug('[EditorWebview] Using local channel')
            break
          default:
            console.warn(
              '[EditorWebview] Unknown editor channel from settings, defaulting to stable:',
              channel
            )
        }

        const url = baseUrl
        console.log('[EditorWebview] Editor URL set to:', url)
        setEditorUrl(url)
      } catch (err) {
        console.error('[EditorWebview] Failed to get webview preload path or editor config:', err)
        setError('Failed to initialize editor')
      }
    }

    loadEditorConfig()
  }, [hasEverBeenVisible, isLoading, isAuthenticated, tokens])

  useEffect(() => {
    const webview = webviewRef.current

    if (!webview || hasInitialized || !preloadPath || !editorUrl) {
      console.debug('[EditorWebview] Skipping webview initialization:', {
        hasWebview: !!webview,
        hasInitialized,
        hasPreloadPath: !!preloadPath,
        hasEditorUrl: !!editorUrl
      })
      return
    }

    console.log('[EditorWebview] Initializing webview')

    const handleLoad = async () => {
      console.debug('[EditorWebview] Webview loaded successfully')
      setIsWebviewReady(true)
    }

    const handleLoadFail = (event: any) => {
      console.error('[EditorWebview] Webview failed to load:', event)
      setError(`Failed to load editor: ${event.errorDescription || 'Unknown error'}`)
    }

    const handleNewWindow = (e: any) => {
      console.debug('[EditorWebview] Opening new window in browser:', e.url)
      e.preventDefault()
      window.electronAPI.openExternal(e.url)
    }

    const handleWillNavigate = (e: any) => {
      const url = e.url

      try {
        // Check if URL is external (different domain from nodes.griptape.ai)
        const urlObj = new URL(url)
        const isExternal =
          !urlObj.hostname.includes('nodes.griptape.ai') &&
          !urlObj.hostname.includes('app.nodes.griptape.ai') &&
          !urlObj.hostname.includes('app-nightly.nodes.griptape.ai')

        if (isExternal) {
          console.debug('[EditorWebview] Opening external link in browser:', url)
          e.preventDefault()
          window.electronAPI.openExternal(url)
        } else {
          console.debug('[EditorWebview] Allowing internal navigation:', url)
        }
      } catch (err) {
        console.error('[EditorWebview] Error parsing URL:', url, err)
      }
    }

    const handleEnterFullscreen = () => {
      console.debug('[EditorWebview] Entering fullscreen')
      window.electronAPI.setFullscreen(true)
    }

    const handleLeaveFullscreen = () => {
      console.debug('[EditorWebview] Leaving fullscreen')
      window.electronAPI.setFullscreen(false)
    }

    webview.addEventListener('did-finish-load', handleLoad)
    webview.addEventListener('did-fail-load', handleLoadFail)
    webview.addEventListener('new-window', handleNewWindow)
    webview.addEventListener('will-navigate', handleWillNavigate)
    webview.addEventListener('enter-html-full-screen', handleEnterFullscreen)
    webview.addEventListener('leave-html-full-screen', handleLeaveFullscreen)

    // Listen for console messages from webview for debugging
    webview.addEventListener('console-message', (e: any) => {
      const level = e.level === 1 ? 'warn' : e.level === 2 ? 'error' : 'log'
      console[level](`[EditorWebview:Webview] ${e.message}`)
    })

    // Set the src to start loading (after listeners are attached)
    // Include navigation path if there's a pending navigation request
    const initialUrl = navigationRef.current ? editorUrl + navigationRef.current.path : editorUrl
    console.log('[EditorWebview] Setting webview src:', initialUrl)
    webview.src = initialUrl
    // Mark this navigation as handled so the navigation effect doesn't duplicate it
    if (navigationRef.current) {
      lastNavigatedTimestamp.current = navigationRef.current.timestamp
    }
    setHasInitialized(true)

    return () => {
      console.debug('[EditorWebview] Cleaning up webview event listeners')
      webview.removeEventListener('did-finish-load', handleLoad)
      webview.removeEventListener('did-fail-load', handleLoadFail)
      webview.removeEventListener('new-window', handleNewWindow)
      webview.removeEventListener('will-navigate', handleWillNavigate)
      webview.removeEventListener('enter-html-full-screen', handleEnterFullscreen)
      webview.removeEventListener('leave-html-full-screen', handleLeaveFullscreen)
    }
  }, [hasInitialized, preloadPath, editorUrl])

  // Handle navigation to a specific path
  useEffect(() => {
    const webview = webviewRef.current

    if (!webview || !hasInitialized || !editorUrl || !navigateTo) {
      return
    }

    // Skip if we already handled this navigation during initialization
    if (lastNavigatedTimestamp.current === navigateTo.timestamp) {
      return
    }

    // Navigate to the specific path
    const targetUrl = editorUrl + navigateTo.path
    console.log('[EditorWebview] Navigating to workflow:', targetUrl)
    webview.src = targetUrl
    lastNavigatedTimestamp.current = navigateTo.timestamp
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timestamp triggers navigation, path is read inside
  }, [navigateTo?.timestamp, hasInitialized, editorUrl])

  // Handle opening the workflow modal via executeJavaScript
  useEffect(() => {
    const webview = webviewRef.current as HTMLWebViewElement & {
      executeJavaScript: (code: string) => Promise<unknown>
    }

    if (!webview || !hasInitialized || !isWebviewReady || !openWorkflowModal) {
      return
    }

    // Skip if we already handled this trigger
    if (lastWorkflowModalTimestamp.current === openWorkflowModal.timestamp) {
      return
    }

    // Dispatch a custom event that the editor can listen for
    console.log('[EditorWebview] Triggering workflow modal open')
    webview
      .executeJavaScript(
        `
      window.dispatchEvent(new CustomEvent('desktop-open-workflow-modal'));
    `
      )
      .catch((err: unknown) => {
        console.error('[EditorWebview] Failed to trigger workflow modal:', err)
      })
    lastWorkflowModalTimestamp.current = openWorkflowModal.timestamp
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timestamp triggers the effect
  }, [openWorkflowModal?.timestamp, hasInitialized, isWebviewReady])

  // Listen for reload command from main process (triggered by CMD-R menu accelerator or channel change)
  useEffect(() => {
    const webview = webviewRef.current

    if (!webview || !isVisible) {
      return
    }

    const handleReload = async () => {
      console.log('[EditorWebview] Reloading editor webview')
      // Re-fetch the editor channel in case it changed
      try {
        const channel = await window.settingsAPI.getEditorChannel()
        const baseUrl =
          channel === 'nightly'
            ? 'https://app-nightly.nodes.griptape.ai'
            : channel === 'local'
              ? 'http://localhost:5173'
              : 'https://app.nodes.griptape.ai'
        const url = baseUrl

        console.debug('[EditorWebview] Reloading with URL:', url)
        // Update the URL state and navigate to the new URL
        setEditorUrl(url)
        webview.src = url
      } catch (err) {
        console.error('[EditorWebview] Failed to reload with updated channel:', err)
        // Fallback to regular reload
        webview.reload()
      }
    }

    window.editorAPI.onReloadWebview(handleReload)

    return () => {
      window.editorAPI.removeReloadWebview(handleReload)
    }
  }, [isVisible])

  // Don't render anything until editor tab is visited for the first time
  if (!hasEverBeenVisible) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'none'
        }}
      />
    )
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)'
        }}
      >
        <div className="text-center">
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show error if not authenticated (shouldn't happen since MainApp checks this)
  if (!isAuthenticated || !tokens) {
    console.error('[EditorWebview] Not authenticated, cannot load editor')
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)'
        }}
      >
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2 text-destructive">Not Authenticated</h2>
          <p className="text-muted-foreground mb-4">Please log in first.</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    console.error('[EditorWebview] Showing error state:', error)
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)'
        }}
      >
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2 text-destructive">Failed to Load Editor</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  // Only render webview if we have preload path and editor URL
  if (!preloadPath || !editorUrl) {
    console.debug('[EditorWebview] Showing initializing state - waiting for config')
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)'
        }}
      >
        <div className="text-center">
          <p className="text-muted-foreground">Initializing editor...</p>
        </div>
      </div>
    )
  }

  console.log('[EditorWebview] Rendering webview element')

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: isVisible ? 'block' : 'none'
      }}
    >
      {/* eslint-disable react/no-unknown-property */}
      <webview
        ref={webviewRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none'
        }}
        partition="persist:editor"
        preload={preloadPath || undefined}
        // @ts-expect-error When boolean, we get `EditorWebview.tsx:236 Received `true` for a non-boolean attribute `allowpopups`.`
        allowpopups="true"
        allowfullscreen="true"
      />
      {/* eslint-enable react/no-unknown-property */}
    </div>
  )
}
