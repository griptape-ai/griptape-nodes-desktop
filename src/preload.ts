// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Expose Python API to renderer process
contextBridge.exposeInMainWorld('pythonAPI', {
  getPythonInfo: () => ipcRenderer.invoke('get-python-info')
});
