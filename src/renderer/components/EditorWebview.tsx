import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';

interface EditorWebviewProps {
  isVisible: boolean;
}

export const EditorWebview: React.FC<EditorWebviewProps> = ({ isVisible }) => {
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const webviewRef = useRef<HTMLWebViewElement>(null);

  useEffect(() => {
    const webview = webviewRef.current;

    console.log('EditorWebview useEffect running, webview:', webview);

    if (!webview || hasInitialized) {
      console.log('Skipping initialization - webview:', !!webview, 'hasInitialized:', hasInitialized);
      return;
    }

    const handleLoad = async () => {
      try {
        console.log('Editor webview loaded, injecting auth...');

        // Get auth tokens from main process
        const authData = await window.oauthAPI.checkAuth();

        if (!authData.isAuthenticated || !authData.tokens) {
          throw new Error('Not authenticated');
        }

        const { tokens, user } = authData;

        console.log('Got auth tokens, expires_in:', tokens.expires_in);

        // Calculate expiration time (current time + expires_in)
        const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in || 86400);

        // Auth0 localStorage key format
        const auth0Key = '@@auth0spajs@@::bK5Fijuoy90ftmcwVUZABA5THOZyzHnH::https://cloud.griptape.ai/api::openid profile email';

        // Auth0 cache entry format
        const auth0CacheEntry = {
          body: {
            client_id: 'bK5Fijuoy90ftmcwVUZABA5THOZyzHnH',
            access_token: tokens.access_token,
            id_token: tokens.id_token,
            scope: 'openid profile email',
            expires_in: tokens.expires_in || 86400,
            token_type: tokens.token_type || 'Bearer',
            decodedToken: {
              user: user
            }
          },
          expiresAt
        };

        console.log('Injecting auth with expiresAt:', expiresAt, 'current time:', Math.floor(Date.now() / 1000));

        // Inject into webview's localStorage
        await webview.executeJavaScript(`
          localStorage.setItem('${auth0Key}', ${JSON.stringify(JSON.stringify(auth0CacheEntry))});
          console.log('✅ Auth injected into editor localStorage');
        `);

        console.log('Auth token injected into editor webview successfully');
      } catch (err) {
        console.error('Failed to inject auth into editor:', err);
        setError(err instanceof Error ? err.message : 'Failed to authenticate editor');
      }
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
  }, [hasInitialized]);

  const content = error ? (
    <div
      style={{
        position: 'fixed',
        top: '48px',
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
  ) : (
    <div
      style={{
        position: 'fixed',
        top: '48px',
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
        partition="persist:editor"
      />
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};
