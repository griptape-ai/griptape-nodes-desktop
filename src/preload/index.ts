// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { logger } from '@/logger';

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('pythonAPI', {
  getPythonInfo: () => ipcRenderer.invoke('get-python-info'),
  getEnvironmentInfo: () => ipcRenderer.invoke('get-environment-info')
});

contextBridge.exposeInMainWorld('oauthAPI', {
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  checkAuth: () => ipcRenderer.invoke('auth:check')
});

contextBridge.exposeInMainWorld('engineAPI', {
  getStatus: () => ipcRenderer.invoke('engine:get-status'),
  getLogs: () => ipcRenderer.invoke('engine:get-logs'),
  clearLogs: () => ipcRenderer.invoke('engine:clear-logs'),
  start: () => ipcRenderer.invoke('engine:start'),
  stop: () => ipcRenderer.invoke('engine:stop'),
  restart: () => ipcRenderer.invoke('engine:restart'),
  onStatusChanged: (callback: (event: any, status: string) => void) => {
    ipcRenderer.on('engine:status-changed', callback);
  },
  removeStatusChanged: (callback: (event: any, status: string) => void) => {
    ipcRenderer.removeListener('engine:status-changed', callback);
  },
  onLog: (callback: (event: any, log: any) => void) => {
    ipcRenderer.on('engine:log', callback);
  },
  removeLog: (callback: (event: any, log: any) => void) => {
    ipcRenderer.removeListener('engine:log', callback);
  }
});

contextBridge.exposeInMainWorld('griptapeAPI', {
  getWorkspace: () => ipcRenderer.invoke('gtn:get-workspace'),
  setWorkspace: (directory: string) => ipcRenderer.invoke('gtn:set-workspace', directory),
  selectDirectory: () => ipcRenderer.invoke('gtn:select-directory')
});

contextBridge.exposeInMainWorld('updateAPI', {
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  isSupported: () => ipcRenderer.invoke('update:is-supported')
});

contextBridge.exposeInMainWorld('electronAPI', {
  getEnvVar: (key: string) => ipcRenderer.invoke('get-env-var', key),
  isDevelopment: () => ipcRenderer.invoke('is-development'),
  checkAuthCompletion: () => ipcRenderer.invoke('check-auth-completion'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});

// Listen for PostMessage from OAuth redirect page in development
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('message', (event) => {
    // Check if this is an OAuth callback message
    if (event.data && event.data.type === 'oauth-callback') {
      logger.info('Received OAuth callback via PostMessage:', event.data);
      
      // Forward to main process via IPC
      ipcRenderer.invoke('oauth-dev-callback', event.data.data);
    }
  });
}
