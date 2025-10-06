import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
}

interface AuthTokens {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  apiKey: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored authentication on app start
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      // Check for dev environment bypass
      const devApiKey = await window.electronAPI?.getEnvVar('GT_CLOUD_API_KEY');
      const isPackaged = await window.electronAPI?.isPackaged();

      if (!isPackaged && devApiKey) {
        console.log('Dev mode detected with API key - bypassing OAuth');
        // Create mock user and tokens for development
        const mockUser = {
          sub: 'dev-user',
          name: 'Development User',
          email: 'dev@griptape.ai',
          email_verified: true
        };

        const mockTokens = {
          access_token: devApiKey,
          id_token: 'dev-id-token',
          token_type: 'Bearer',
          expires_in: 86400
        };

        setUser(mockUser);
        setTokens(mockTokens);
        setApiKey(devApiKey);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Load from persistent store if credential storage was previously enabled
      const credentialStorageEnabled = await window.onboardingAPI.isCredentialStorageEnabled();
      if (credentialStorageEnabled) {
        const hasEncryptedStore = await window.oauthAPI.hasExistingEncryptedStore();
        if (hasEncryptedStore) {
          await window.oauthAPI.loadFromPersistentStore();
        }
      }

      // Check stored auth from backend (electron-store)
      const result = await window.oauthAPI.checkAuth();

      if (result.isAuthenticated && result.user && result.tokens) {
        // Check if tokens are expired
        const currentTime = Math.floor(Date.now() / 1000);
        const expiresAt = result.expiresAt;

        if (!expiresAt || currentTime >= expiresAt) {
          // Tokens are expired or have no expiration time (legacy data), attempt to refresh if we have a refresh token
          console.log('Stored tokens are expired or missing expiration time');

          if (result.tokens.refresh_token) {
            console.log('Attempting to refresh tokens using refresh_token...');
            const refreshResult = await window.oauthAPI.refreshToken(result.tokens.refresh_token);

            if (refreshResult.success && refreshResult.tokens) {
              console.log('Token refresh successful');
              setTokens(refreshResult.tokens);
              setUser(result.user);
              setApiKey(result.apiKey);
              setIsAuthenticated(true);
            } else {
              // Refresh failed - refresh token is invalid/expired
              console.log('Token refresh failed, requiring re-login:', refreshResult.error);
              await window.oauthAPI.logout();
              setIsAuthenticated(false);
            }
          } else {
            // No refresh token available
            console.log('No refresh token available, requiring re-login');
            await window.oauthAPI.logout();
            setIsAuthenticated(false);
          }
        } else {
          // Tokens are still valid
          setTokens(result.tokens);
          setUser(result.user);
          setApiKey(result.apiKey);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      // Don't set isLoading to true during login - we want the login page to remain visible

      // Check if we're in dev mode first
      const devApiKey = await window.electronAPI?.getEnvVar('GT_CLOUD_API_KEY');
      const isPackaged = await window.electronAPI?.isPackaged();

      if (!isPackaged && devApiKey) {
        // Dev mode bypass
        console.log('Using dev API key bypass');
        const mockUser = {
          sub: 'dev-user',
          name: 'Development User',
          email: 'dev@griptape.ai',
          email_verified: true
        };
        
        const mockTokens = {
          access_token: devApiKey,
          id_token: 'dev-id-token',
          token_type: 'Bearer',
          expires_in: 86400
        };
        
        setUser(mockUser);
        setTokens(mockTokens);
        setApiKey(devApiKey);
        setIsAuthenticated(true);
        setIsLoading(false); // Make sure loading is false
        return;
      }
      
      // Normal OAuth flow
      const result = await window.oauthAPI.login();
      
      if (result.success && result.tokens && result.user) {
        setTokens(result.tokens);
        setUser(result.user);
        setApiKey(result.apiKey || null);
        setIsAuthenticated(true);
        // Storage is handled by the backend (electron-store)
      } else {
        throw new Error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    // Call backend logout (clears user/tokens but keeps API key)
    await window.oauthAPI.logout();
    
    // Clear renderer state
    setTokens(null);
    setUser(null);
    setApiKey(null);
    setIsAuthenticated(false);
  };

  const value: AuthContextValue = {
    isLoading,
    isAuthenticated,
    user,
    tokens,
    apiKey,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};