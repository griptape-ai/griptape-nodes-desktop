// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import type { UpdateInfo } from "velopack";

interface VelopackBridgeApi {
  getVersion: () => Promise<string>,
  checkForUpdates: () => Promise<UpdateInfo>,
  downloadUpdates: (updateInfo: UpdateInfo) => Promise<boolean>,
  applyUpdates: (updateInfo: UpdateInfo) => Promise<boolean>,
  getChannel: () => Promise<string>,
  setChannel: (channel: string) => Promise<boolean>,
  getAvailableChannels: () => Promise<string[]>,
  getLogicalChannelName: (channel: string) => Promise<string>,
}

declare global {
  interface Window {
    velopackApi: VelopackBridgeApi;
  }
}

const velopackApi: VelopackBridgeApi = {
  getVersion: () => ipcRenderer.invoke("velopack:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("velopack:check-for-update"),
  downloadUpdates: (updateInfo: UpdateInfo) => ipcRenderer.invoke("velopack:download-update", updateInfo),
  applyUpdates: (updateInfo: UpdateInfo) => ipcRenderer.invoke("velopack:apply-update", updateInfo),
  getChannel: () => ipcRenderer.invoke("velopack:get-channel"),
  setChannel: (channel: string) => ipcRenderer.invoke("velopack:set-channel", channel),
  getAvailableChannels: () => ipcRenderer.invoke("velopack:get-available-channels"),
  getLogicalChannelName: (channel: string) => ipcRenderer.invoke("velopack:get-logical-channel-name", channel)
};

contextBridge.exposeInMainWorld("velopackApi", velopackApi);

contextBridge.exposeInMainWorld('electron', {
  getPreloadPath: () => ipcRenderer.sendSync('get-preload-path'),
  getWebviewPreloadPath: () => ipcRenderer.sendSync('get-webview-preload-path')
});

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('pythonAPI', {
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
  selectDirectory: () => ipcRenderer.invoke('gtn:select-directory'),
  refreshConfig: () => ipcRenderer.invoke('gtn:refresh-config'),
  onWorkspaceChanged: (callback: (event: any, directory: string) => void) => {
    ipcRenderer.on('workspace-changed', callback);
  },
  removeWorkspaceChanged: (callback: (event: any, directory: string) => void) => {
    ipcRenderer.removeListener('workspace-changed', callback);
  }
});

contextBridge.exposeInMainWorld('updateAPI', {
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  isSupported: () => ipcRenderer.invoke('update:is-supported'),
  onDownloadStarted: (callback: () => void) => {
    ipcRenderer.on('update:download-started', callback);
  },
  onDownloadProgress: (callback: (event: any, progress: number) => void) => {
    ipcRenderer.on('update:download-progress', callback);
  },
  onDownloadComplete: (callback: () => void) => {
    ipcRenderer.on('update:download-complete', callback);
  },
  removeDownloadStarted: (callback: () => void) => {
    ipcRenderer.removeListener('update:download-started', callback);
  },
  removeDownloadProgress: (callback: (event: any, progress: number) => void) => {
    ipcRenderer.removeListener('update:download-progress', callback);
  },
  removeDownloadComplete: (callback: () => void) => {
    ipcRenderer.removeListener('update:download-complete', callback);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  getEnvVar: (key: string) => ipcRenderer.invoke('get-env-var', key),
  isPackaged: () => ipcRenderer.invoke('is-packaged'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
});

