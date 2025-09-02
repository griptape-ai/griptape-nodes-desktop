import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [browserOpened, setBrowserOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleLogin = async () => {
    try {
      setError(null);
      setBrowserOpened(true);
      await login();
      // The login promise will resolve when auth completes
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
      setBrowserOpened(false);
    }
  };

  const checkAuthCompletion = async () => {
    try {
      setChecking(true);
      setError(null);
      
      // Check if auth is complete via IPC
      const result = await (window as any).electronAPI?.checkAuthCompletion();
      
      if (!result.success) {
        setError('Authentication not yet complete. Please finish logging in and try again.');
      }
    } catch (error) {
      setError('Failed to check authentication status');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <h1 style={styles.title}>Griptape Nodes Desktop</h1>
        <p style={styles.subtitle}>
          Welcome to Griptape Nodes Desktop. Please log in to continue.
        </p>
        
        <button 
          onClick={handleLogin} 
          style={styles.loginButton}
        >
          Log In
        </button>
        
        {browserOpened && (
          <>
            <p style={styles.helpText}>
              Complete the login in your browser, then click the button below.
            </p>
            <button 
              onClick={checkAuthCompletion}
              disabled={checking}
              style={styles.checkButton}
            >
              {checking ? 'Checking...' : 'I\'ve Completed Login'}
            </button>
          </>
        )}
        
        {error && (
          <div style={styles.error}>
            <p>Login failed: {error}</p>
            <p>Please try again.</p>
          </div>
        )}
        
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Powered by Griptape
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  loginCard: {
    backgroundColor: 'white',
    padding: '3rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
    maxWidth: '400px',
    width: '100%',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#333',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#666',
    marginBottom: '2rem',
    lineHeight: '1.5',
  },
  loginButton: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s',
    marginBottom: '2rem',
  },
  footer: {
    borderTop: '1px solid #eee',
    paddingTop: '1rem',
  },
  footerText: {
    fontSize: '0.9rem',
    color: '#999',
    margin: 0,
  },
  loginButtonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
  },
  helpText: {
    fontSize: '0.95rem',
    color: '#28a745',
    marginTop: '1rem',
    marginBottom: '1rem',
    padding: '0.75rem',
    backgroundColor: '#d4edda',
    borderRadius: '4px',
    border: '1px solid #c3e6cb',
  },
  checkButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '1rem',
    transition: 'background-color 0.2s',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '1rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    border: '1px solid #f5c6cb',
  },
};

export default LoginPage;