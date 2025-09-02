// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('pythonAPI', {
  getPythonInfo: () => ipcRenderer.invoke('get-python-info')
});

contextBridge.exposeInMainWorld('oauthAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  checkAuth: () => ipcRenderer.invoke('auth:check')
});

contextBridge.exposeInMainWorld('electronAPI', {
  getEnvVar: (key: string) => ipcRenderer.invoke('get-env-var', key),
  isDevelopment: () => ipcRenderer.invoke('is-development'),
  checkAuthCompletion: () => ipcRenderer.invoke('check-auth-completion'),
  onAuthCallback: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('auth:callback', callback);
  },
  removeAuthCallback: (callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener('auth:callback', callback);
  },
  onAuthLoginSuccess: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('auth:login-success', callback);
  },
  removeAuthLoginSuccess: (callback: (event: any, data: any) => void) => {
    ipcRenderer.removeListener('auth:login-success', callback);
  },
  onAuthLoginError: (callback: (event: any, error: string) => void) => {
    ipcRenderer.on('auth:login-error', callback);
  },
  removeAuthLoginError: (callback: (event: any, error: string) => void) => {
    ipcRenderer.removeListener('auth:login-error', callback);
  },
  onAuthLogout: (callback: () => void) => {
    ipcRenderer.on('auth:logout-success', callback);
  },
  removeAuthLogout: (callback: () => void) => {
    ipcRenderer.removeListener('auth:logout-success', callback);
  }
});

// Listen for PostMessage from OAuth redirect page in development
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('message', (event) => {
    // Check if this is an OAuth callback message
    if (event.data && event.data.type === 'oauth-callback') {
      console.log('Received OAuth callback via PostMessage:', event.data);
      
      // Forward to main process via IPC
      ipcRenderer.invoke('oauth-dev-callback', event.data.data);
    }
  });
}
