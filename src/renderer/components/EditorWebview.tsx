import React, { useEffect, useState, useRef } from 'react'

interface EditorWebviewProps {
  isVisible: boolean
}

export const EditorWebview: React.FC<EditorWebviewProps> = ({ isVisible }) => {
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [preloadPath, setPreloadPath] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [editorUrl, setEditorUrl] = useState<string | null>(null)
  const webviewRef = useRef<HTMLWebViewElement>(null)

  // Check auth before doing anything else
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking auth before creating webview...')
        const authData = await window.oauthAPI.checkAuth()

        if (!authData.isAuthenticated || !authData.tokens) {
          console.error('Not authenticated, cannot load editor')
          setError('Not authenticated. Please log in first.')
          setIsCheckingAuth(false)
          return
        }

        console.log('Auth confirmed, ready to create webview')
        setAuthReady(true)
        setIsCheckingAuth(false)
      } catch (err) {
        console.error('Failed to check auth:', err)
        setError('Failed to verify authentication')
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [])

  // Get the webview preload path and editor URL only after auth is ready
  useEffect(() => {
    if (!authReady) {
      return
    }

    const loadEditorConfig = async () => {
      try {
        const path = window.electron.getWebviewPreloadPath()
        console.log('Got webview preload path:', path)
        setPreloadPath(path)

        // Get the configured editor channel
        const channel = await window.settingsAPI.getEditorChannel()
        const baseUrl =
          channel === 'nightly'
            ? 'https://app-nightly.nodes.griptape.ai'
            : 'https://app.nodes.griptape.ai'
        const url = `${baseUrl}?embedded=true`
        console.log('Editor URL set to:', url, '(channel:', channel, ')')
        setEditorUrl(url)
      } catch (err) {
        console.error('Failed to get webview preload path or editor config:', err)
        setError('Failed to initialize editor')
      }
    }

    loadEditorConfig()
  }, [authReady])

  useEffect(() => {
    const webview = webviewRef.current

    console.log(
      'EditorWebview useEffect running, webview:',
      webview,
      'preloadPath:',
      preloadPath,
      'editorUrl:',
      editorUrl
    )

    if (!webview || hasInitialized || !preloadPath || !editorUrl) {
      console.log(
        'Skipping initialization - webview:',
        !!webview,
        'hasInitialized:',
        hasInitialized,
        'preloadPath:',
        preloadPath,
        'editorUrl:',
        editorUrl
      )
      return
    }

    const handleLoad = async () => {
      console.log('Editor webview loaded successfully')
    }

    const handleLoadFail = (event: any) => {
      console.error('Editor webview failed to load:', event)
      setError(`Failed to load editor: ${event.errorDescription || 'Unknown error'}`)
    }

    const handleNewWindow = (e: any) => {
      e.preventDefault() // Prevent webview from opening new window

      const url = e.url
      console.log('Opening new window link in default browser:', url)

      // Open in system default browser
      window.electronAPI.openExternal(url)
    }

    const handleWillNavigate = (e: any) => {
      const url = e.url

      try {
        // Check if URL is external (different domain from nodes.griptape.ai, app.nodes.griptape.ai, or app-nightly.nodes.griptape.ai)
        const urlObj = new URL(url)
        const isExternal =
          !urlObj.hostname.includes('nodes.griptape.ai') &&
          !urlObj.hostname.includes('app.nodes.griptape.ai') &&
          !urlObj.hostname.includes('app-nightly.nodes.griptape.ai')

        if (isExternal) {
          e.preventDefault()
          console.log('Opening external link in default browser:', url)
          window.electronAPI.openExternal(url)
        } else {
          console.log('Allowing internal navigation to:', url)
        }
      } catch (err) {
        console.error('Error parsing URL:', url, err)
      }
    }

    const handleEnterFullscreen = () => {
      console.log('Webview entering fullscreen')
      window.electronAPI.setFullscreen(true)
    }

    const handleLeaveFullscreen = () => {
      console.log('Webview leaving fullscreen')
      window.electronAPI.setFullscreen(false)
    }

    console.log('Adding event listeners to webview')
    webview.addEventListener('did-finish-load', handleLoad)
    webview.addEventListener('did-fail-load', handleLoadFail)
    webview.addEventListener('new-window', handleNewWindow)
    webview.addEventListener('will-navigate', handleWillNavigate)
    webview.addEventListener('enter-html-full-screen', handleEnterFullscreen)
    webview.addEventListener('leave-html-full-screen', handleLeaveFullscreen)

    // Also listen for console messages from webview for debugging
    webview.addEventListener('console-message', (e: any) => {
      console.log('Webview console:', e.message)
    })

    // NOW set the src to start loading (after listeners are attached)
    console.log('Setting webview src to trigger load:', editorUrl)
    webview.src = editorUrl

    setHasInitialized(true)

    return () => {
      console.log('Cleaning up webview event listeners')
      webview.removeEventListener('did-finish-load', handleLoad)
      webview.removeEventListener('did-fail-load', handleLoadFail)
      webview.removeEventListener('new-window', handleNewWindow)
      webview.removeEventListener('will-navigate', handleWillNavigate)
      webview.removeEventListener('enter-html-full-screen', handleEnterFullscreen)
      webview.removeEventListener('leave-html-full-screen', handleLeaveFullscreen)
    }
  }, [hasInitialized, preloadPath, editorUrl])

  // Listen for reload command from main process (triggered by CMD-R menu accelerator or channel change)
  useEffect(() => {
    const webview = webviewRef.current

    if (!webview || !isVisible) {
      return
    }

    const handleReload = async () => {
      console.log('Reloading editor webview')

      // Re-fetch the editor channel in case it changed
      try {
        const channel = await window.settingsAPI.getEditorChannel()
        const baseUrl =
          channel === 'nightly'
            ? 'https://app-nightly.nodes.griptape.ai'
            : 'https://app.nodes.griptape.ai'
        const url = `${baseUrl}?embedded=true`

        console.log('Reloading with new URL:', url, '(channel:', channel, ')')

        // Update the URL state and navigate to the new URL
        setEditorUrl(url)
        webview.src = url
      } catch (err) {
        console.error('Failed to reload with updated channel:', err)
        // Fallback to regular reload
        webview.reload()
      }
    }

    window.editorAPI.onReloadWebview(handleReload)

    return () => {
      window.editorAPI.removeReloadWebview(handleReload)
    }
  }, [isVisible])

  // Show loading state while checking auth
  if (isCheckingAuth) {
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

  // Show error state
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

  // Only render webview if auth is ready and we have preload path and editor URL
  if (!authReady || !preloadPath || !editorUrl) {
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
        // @ts-expect-error When boolean, we get `EditorWebview.tsx:236 Received `true` for a non-boolean attribute `allowpopups`.`
        allowpopups="true"
        allowfullscreen="true"
      />
      {/* eslint-enable react/no-unknown-property */}
    </div>
  )
}
