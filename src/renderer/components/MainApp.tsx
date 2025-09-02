import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const MainApp: React.FC = () => {
  const { user, logout, apiKey } = useAuth();
  const [pythonInfo, setPythonInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadPythonInfo();
  }, []);

  const loadPythonInfo = async () => {
    try {
      const result = await window.pythonAPI.getPythonInfo();
      setPythonInfo(result);
    } catch (error) {
      console.error('Failed to load Python info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      alert('API Key copied to clipboard!');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Griptape Nodes Desktop</h1>
        <div style={styles.userInfo}>
          <span style={styles.username}>Welcome, {user?.name || user?.email}</span>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {apiKey && (
          <div style={styles.apiKeySection}>
            <h2>Griptape Cloud API Key</h2>
            <div style={styles.infoBox}>
              <div style={styles.apiKeyContainer}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                  style={styles.apiKeyInput}
                />
                <button onClick={() => setShowApiKey(!showApiKey)} style={styles.toggleButton}>
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button onClick={copyApiKey} style={styles.copyButton}>
                  Copy
                </button>
              </div>
              <p style={styles.apiKeyNote}>
                This API key provides access to Griptape Cloud services. Keep it secure!
              </p>
            </div>
          </div>
        )}

        <div style={styles.pythonSection}>
          {loading ? (
            <p>Loading Python information...</p>
          ) : pythonInfo ? (
            <>
              <h2>Python Information</h2>
              {pythonInfo.success ? (
                <div style={styles.infoBox}>
                  <p><strong>Bundled Version:</strong> {pythonInfo.version}</p>
                  <p><strong>Executable Path:</strong> {pythonInfo.executable}</p>
                  <hr />
                  <p><strong>Python Command Output:</strong></p>
                  <pre style={styles.pre}>{pythonInfo.versionOutput}</pre>
                  <pre style={styles.pre}>{pythonInfo.pathOutput}</pre>
                </div>
              ) : (
                <p style={styles.error}>Error: {pythonInfo.error}</p>
              )}

              <h2>Griptape Nodes Information</h2>
              <div style={styles.infoBox}>
                <p><strong>Executable Path:</strong> {pythonInfo.griptapeNodesPath}</p>
                <p><strong>Version:</strong> {pythonInfo.griptapeNodesVersion}</p>
              </div>
            </>
          ) : (
            <p style={styles.error}>Failed to load Python information</p>
          )}
        </div>
      </main>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  header: {
    backgroundColor: 'white',
    padding: '1rem 2rem',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    color: '#333',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  username: {
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  main: {
    padding: '2rem',
  },
  apiKeySection: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '2rem',
  },
  apiKeyContainer: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  apiKeyInput: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid #dee2e6',
    fontFamily: 'monospace',
    fontSize: '0.9rem',
  },
  toggleButton: {
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    border: '1px solid #dee2e6',
    backgroundColor: '#f8f9fa',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  copyButton: {
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  apiKeyNote: {
    color: '#6c757d',
    fontSize: '0.9rem',
    margin: 0,
  },
  pythonSection: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  infoBox: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    fontFamily: 'monospace',
  },
  pre: {
    backgroundColor: '#e9ecef',
    padding: '0.5rem',
    borderRadius: '4px',
    whiteSpace: 'pre-wrap' as const,
    fontSize: '0.9rem',
  },
  error: {
    color: '#dc3545',
  },
};

export default MainApp;