import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

interface EditorWebviewProps {
  isVisible: boolean;
}

export const EditorWebview: React.FC<EditorWebviewProps> = ({ isVisible }) => {
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [preloadPath, setPreloadPath] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const webviewRef = useRef<HTMLWebViewElement>(null);

  // Check auth before doing anything else
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking auth before creating webview...');
        const authData = await window.oauthAPI.checkAuth();

        if (!authData.isAuthenticated || !authData.tokens) {
          console.error('Not authenticated, cannot load editor');
          setError('Not authenticated. Please log in first.');
          setIsCheckingAuth(false);
          return;
        }

        console.log('Auth confirmed, ready to create webview');
        setAuthReady(true);
        setIsCheckingAuth(false);
      } catch (err) {
        console.error('Failed to check auth:', err);
        setError('Failed to verify authentication');
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Get the webview preload path only after auth is ready
  useEffect(() => {
    if (!authReady) {
      return;
    }

    try {
      const path = window.electron.getWebviewPreloadPath();
      console.log('Got webview preload path:', path);
      setPreloadPath(path);
    } catch (err) {
      console.error('Failed to get webview preload path:', err);
      setError('Failed to initialize editor');
    }
  }, [authReady]);

  useEffect(() => {
    const webview = webviewRef.current;

    console.log('EditorWebview useEffect running, webview:', webview, 'preloadPath:', preloadPath);

    if (!webview || hasInitialized || !preloadPath) {
      console.log('Skipping initialization - webview:', !!webview, 'hasInitialized:', hasInitialized, 'preloadPath:', preloadPath);
      return;
    }

    const handleLoad = async () => {
      console.log('Editor webview loaded successfully');
    };

    const handleLoadFail = (event: any) => {
      console.error('Editor webview failed to load:', event);
      setError(`Failed to load editor: ${event.errorDescription || 'Unknown error'}`);
    };

    const handleNewWindow = (e: any) => {
      e.preventDefault(); // Prevent webview from opening new window

      const url = e.url;
      console.log('Opening new window link in default browser:', url);

      // Open in system default browser
      window.electronAPI.openExternal(url);
    };

    const handleWillNavigate = (e: any) => {
      const url = e.url;

      try {
        // Check if URL is external (different domain from nodes.griptape.ai)
        const urlObj = new URL(url);
        const isExternal = !urlObj.hostname.includes('nodes.griptape.ai');

        if (isExternal) {
          e.preventDefault();
          console.log('Opening external link in default browser:', url);
          window.electronAPI.openExternal(url);
        } else {
          console.log('Allowing internal navigation to:', url);
        }
      } catch (err) {
        console.error('Error parsing URL:', url, err);
      }
    };

    console.log('Adding event listeners to webview');
    webview.addEventListener('did-finish-load', handleLoad);
    webview.addEventListener('did-fail-load', handleLoadFail);
    webview.addEventListener('new-window', handleNewWindow);
    webview.addEventListener('will-navigate', handleWillNavigate);

    // Also listen for console messages from webview for debugging
    webview.addEventListener('console-message', (e: any) => {
      console.log('Webview console:', e.message);
    });

    // NOW set the src to start loading (after listeners are attached)
    console.log('Setting webview src to trigger load');
    webview.src = 'https://nodes.griptape.ai';

    setHasInitialized(true);

    return () => {
      console.log('Cleaning up webview event listeners');
      webview.removeEventListener('did-finish-load', handleLoad);
      webview.removeEventListener('did-fail-load', handleLoadFail);
      webview.removeEventListener('new-window', handleNewWindow);
      webview.removeEventListener('will-navigate', handleWillNavigate);
    };
  }, [hasInitialized, preloadPath]);

  // Show loading state while checking auth
  if (isCheckingAuth) {
    const content = (
      <div
        style={{
          position: 'fixed',
          top: '57px',
          left: '256px',
          right: 0,
          bottom: 0,
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)',
          zIndex: 10
        }}
      >
        <div className="text-center">
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
    return ReactDOM.createPortal(content, document.body);
  }

  // Show error state
  if (error) {
    const content = (
      <div
        style={{
          position: 'fixed',
          top: '57px',
          left: '256px',
          right: 0,
          bottom: 0,
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)',
          zIndex: 10
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
    );
    return ReactDOM.createPortal(content, document.body);
  }

  // Only render webview if auth is ready and we have preload path
  if (!authReady || !preloadPath) {
    const content = (
      <div
        style={{
          position: 'fixed',
          top: '57px',
          left: '256px',
          right: 0,
          bottom: 0,
          display: isVisible ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--background)',
          zIndex: 10
        }}
      >
        <div className="text-center">
          <p className="text-muted-foreground">Initializing editor...</p>
        </div>
      </div>
    );
    return ReactDOM.createPortal(content, document.body);
  }

  const content = (
    <div
      style={{
        position: 'fixed',
        top: '57px',
        left: '256px',
        right: 0,
        bottom: 0,
        display: isVisible ? 'block' : 'none',
        zIndex: 10
      }}
    >
      <webview
        ref={webviewRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none'
        }}
        partition="editor"
        preload={preloadPath || undefined}
      />
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};
