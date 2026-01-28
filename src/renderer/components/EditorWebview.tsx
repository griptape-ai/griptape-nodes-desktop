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
  const navigationRef = useRef(navigateTo)
  navigationRef.current = navigateTo
  const lastNavigatedTimestamp = useRef<number | null>(null)
  const lastWorkflowModalTimestamp = useRef<number | null>(null)

  const { isLoading, isAuthenticated, tokens } = useAuth()

  // Track first visibility to defer loading until editor tab is opened
  useEffect(() => {
    if (isVisible && !hasEverBeenVisible) {
      console.log('[EditorWebview] Editor tab opened for first time, starting load')
      setHasEverBeenVisible(true)
    }
  }, [isVisible, hasEverBeenVisible])

  // Load editor config after auth is ready and editor has been visited
  useEffect(() => {
    if (!hasEverBeenVisible) {
      return
    }

    if (isLoading || !isAuthenticated || !tokens) {
      console.debug('[EditorWebview] Waiting for auth...')
      return
    }

    const loadEditorConfig = async () => {
      try {
        const path = window.electron.getWebviewPreloadPath()
        setPreloadPath(path)

        const channel = await window.settingsAPI.getEditorChannel()
        let baseUrl = 'https://app.nodes.griptape.ai'
        switch (channel) {
          case 'nightly':
            baseUrl = 'https://app-nightly.nodes.griptape.ai'
            break
          case 'local':
            baseUrl = 'http://localhost:5173'
            break
        }

        console.log('[EditorWebview] Editor URL set to:', baseUrl)
        setEditorUrl(baseUrl)
      } catch (err) {
        console.error('[EditorWebview] Failed to load editor config:', err)
        setError('Failed to initialize editor')
      }
    }

    loadEditorConfig()
  }, [hasEverBeenVisible, isLoading, isAuthenticated, tokens])

  // Initialize webview once we have all required config
  useEffect(() => {
    const webview = webviewRef.current

    if (!webview || hasInitialized || !preloadPath || !editorUrl) {
      return
    }

    console.log('[EditorWebview] Initializing webview')

    const handleLoad = () => {
      console.debug('[EditorWebview] Webview loaded successfully')
      setIsWebviewReady(true)
    }

    const handleLoadFail = (event: any) => {
      console.error('[EditorWebview] Webview failed to load:', event)
      setError(`Failed to load editor: ${event.errorDescription || 'Unknown error'}`)
    }

    const handleNewWindow = (e: any) => {
      e.preventDefault()
      window.electronAPI.openExternal(e.url)
    }

    const handleWillNavigate = (e: any) => {
      try {
        const urlObj = new URL(e.url)
        const isExternal =
          !urlObj.hostname.includes('nodes.griptape.ai') &&
          !urlObj.hostname.includes('app.nodes.griptape.ai') &&
          !urlObj.hostname.includes('app-nightly.nodes.griptape.ai')

        if (isExternal) {
          e.preventDefault()
          window.electronAPI.openExternal(e.url)
        }
      } catch (err) {
        console.error('[EditorWebview] Error parsing URL:', e.url, err)
      }
    }

    const handleEnterFullscreen = () => window.electronAPI.setFullscreen(true)
    const handleLeaveFullscreen = () => window.electronAPI.setFullscreen(false)

    webview.addEventListener('did-finish-load', handleLoad)
    webview.addEventListener('did-fail-load', handleLoadFail)
    webview.addEventListener('new-window', handleNewWindow)
    webview.addEventListener('will-navigate', handleWillNavigate)
    webview.addEventListener('enter-html-full-screen', handleEnterFullscreen)
    webview.addEventListener('leave-html-full-screen', handleLeaveFullscreen)

    webview.addEventListener('console-message', (e: any) => {
      const level = e.level === 1 ? 'warn' : e.level === 2 ? 'error' : 'log'
      console[level](`[EditorWebview:Webview] ${e.message}`)
    })

    // Include pending navigation path in initial URL
    const initialUrl = navigationRef.current ? editorUrl + navigationRef.current.path : editorUrl
    console.log('[EditorWebview] Setting webview src:', initialUrl)
    webview.src = initialUrl

    if (navigationRef.current) {
      lastNavigatedTimestamp.current = navigationRef.current.timestamp
    }
    setHasInitialized(true)

    return () => {
      webview.removeEventListener('did-finish-load', handleLoad)
      webview.removeEventListener('did-fail-load', handleLoadFail)
      webview.removeEventListener('new-window', handleNewWindow)
      webview.removeEventListener('will-navigate', handleWillNavigate)
      webview.removeEventListener('enter-html-full-screen', handleEnterFullscreen)
      webview.removeEventListener('leave-html-full-screen', handleLeaveFullscreen)
    }
  }, [hasInitialized, preloadPath, editorUrl])

  // Handle navigation to a specific workflow path
  useEffect(() => {
    const webview = webviewRef.current

    if (!webview || !hasInitialized || !editorUrl || !navigateTo) {
      return
    }

    if (lastNavigatedTimestamp.current === navigateTo.timestamp) {
      return
    }

    const targetUrl = editorUrl + navigateTo.path
    console.log('[EditorWebview] Navigating to workflow:', targetUrl)
    webview.src = targetUrl
    lastNavigatedTimestamp.current = navigateTo.timestamp
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timestamp triggers navigation
  }, [navigateTo?.timestamp, hasInitialized, editorUrl])

  // Handle opening the workflow modal via executeJavaScript
  useEffect(() => {
    const webview = webviewRef.current as HTMLWebViewElement & {
      executeJavaScript: (code: string) => Promise<unknown>
    }

    if (!webview || !hasInitialized || !isWebviewReady || !openWorkflowModal) {
      return
    }

    if (lastWorkflowModalTimestamp.current === openWorkflowModal.timestamp) {
      return
    }

    console.log('[EditorWebview] Triggering workflow modal open')
    webview
      .executeJavaScript(`window.dispatchEvent(new CustomEvent('desktop-open-workflow-modal'));`)
      .catch((err: unknown) => {
        console.error('[EditorWebview] Failed to trigger workflow modal:', err)
      })
    lastWorkflowModalTimestamp.current = openWorkflowModal.timestamp
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timestamp triggers the effect
  }, [openWorkflowModal?.timestamp, hasInitialized, isWebviewReady])

  // Handle CMD-R reload - listener registered on mount, webview checked at reload time
  useEffect(() => {
    const handleReload = async () => {
      const webview = webviewRef.current
      if (!webview) {
        return
      }

      console.log('[EditorWebview] Reloading editor webview')
      try {
        const channel = await window.settingsAPI.getEditorChannel()
        let baseUrl = 'https://app.nodes.griptape.ai'
        switch (channel) {
          case 'nightly':
            baseUrl = 'https://app-nightly.nodes.griptape.ai'
            break
          case 'local':
            baseUrl = 'http://localhost:5173'
            break
        }

        setEditorUrl(baseUrl)
        webview.src = baseUrl
      } catch (err) {
        console.error('[EditorWebview] Failed to reload:', err)
        webview.reload()
      }
    }

    window.editorAPI.onReloadWebview(handleReload)
    return () => window.editorAPI.removeReloadWebview(handleReload)
  }, [])

  // Deferred render - don't mount webview until editor tab is first visited
  if (!hasEverBeenVisible) {
    return <div style={{ width: '100%', height: '100%', display: 'none' }} />
  }

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

  // Defensive check - MainApp should prevent this state
  if (!isAuthenticated || !tokens) {
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

  if (error) {
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

  if (!preloadPath || !editorUrl) {
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
        // @ts-expect-error allowpopups must be string "true" not boolean
        allowpopups="true"
        allowfullscreen="true"
      />
      {/* eslint-enable react/no-unknown-property */}
    </div>
  )
}
