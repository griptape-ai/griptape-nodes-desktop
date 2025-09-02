import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { Worker } from 'worker_threads';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { PythonService } from './services/python';
import { OAuthService } from './services/auth';
import { HttpAuthService } from './services/auth/http';
import { CustomAuthService } from './services/auth/custom';

// Build info injected at compile time
declare const __BUILD_INFO__: {
  version: string;
  commitHash: string;
  commitDate: string;
  branch: string;
  buildDate: string;
  buildId: string;
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Register custom URL scheme for OAuth callback
const OAUTH_SCHEME = 'gtn';
if (!app.isDefaultProtocolClient(OAUTH_SCHEME)) {
  app.setAsDefaultProtocolClient(OAUTH_SCHEME);
}

// Initialize services
const pythonService = new PythonService();
const authService = (process.env.NODE_ENV === 'development')
  ? new HttpAuthService()
  : new CustomAuthService();

authService.start();

const startBackgroundSetup = () => {
  console.log('Starting background setup...');
  
  const setupWorker = new Worker(path.join(__dirname, '../workers/setup/index.ts'));
  
  setupWorker.on('message', (message) => {
    if (message.type === 'success') {
      console.log('Background setup completed:', message.message);
    } else if (message.type === 'error') {
      console.error('Background setup failed:', message.message);
    }
  });
  
  setupWorker.on('error', (error) => {
    console.error('Setup worker error:', error);
  });
  
  setupWorker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Setup worker stopped with exit code ${code}`);
    } else {
      console.log('Setup worker completed successfully');
    }
  });
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools in development only
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Set up application menu
  createMenu();

  // Enable keyboard shortcuts for copy/paste
  setupKeyboardShortcuts(mainWindow);

  // Set up IPC handlers
  setupIPC();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  createWindow();
  
  // Debug: Check resource paths
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('process.resourcesPath:', process.resourcesPath);
  console.log('process.cwd():', process.cwd());
  console.log('app.getAppPath():', app.getAppPath());
  
  // Start post-install setup in background thread
  startBackgroundSetup();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


// Ensure only one instance of the app runs
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const createMenu = () => {
  const template = [
    {
      label: app.getName(),
      submenu: [
        {
          label: `About ${app.getName()}`,
          click: showAboutDialog
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);
};

const showAboutDialog = () => {
  const detailText = [
    `Version: ${__BUILD_INFO__.version}`,
    `Commit: ${__BUILD_INFO__.commitHash.substring(0, 8)}`,
    `Branch: ${__BUILD_INFO__.branch}`,
    `Build Date: ${new Date(__BUILD_INFO__.buildDate).toLocaleString()}`,
    '',
    `Platform: ${process.platform} (${process.arch})`,
    `Electron: ${process.versions.electron}`,
    `Chrome: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`,
    '',
    `Python: ${pythonService.getBundledPythonVersion()}`,
    `uv: ${pythonService.getUvVersion()}`
  ].join('\n');

  dialog.showMessageBox({
    type: 'info',
    title: `About ${app.getName()}`,
    message: app.getName(),
    detail: detailText,
    buttons: ['OK']
  });
};

const setupKeyboardShortcuts = (mainWindow: BrowserWindow) => {
  // Register global shortcuts for copy/paste/cut/select all
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.meta || input.control) {
      switch (input.key.toLowerCase()) {
        case 'c':
          mainWindow.webContents.copy();
          break;
        case 'v':
          mainWindow.webContents.paste();
          break;
        case 'x':
          mainWindow.webContents.cut();
          break;
        case 'a':
          mainWindow.webContents.selectAll();
          break;
        case 'z':
          if (input.shift) {
            mainWindow.webContents.redo();
          } else {
            mainWindow.webContents.undo();
          }
          break;
      }
    }
  });

  // Set up right-click context menu
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectall' }
    ]);
    menu.popup({ window: mainWindow });
  });
};

const setupIPC = () => {
  // Handle Python info requests
  ipcMain.handle('get-python-info', async () => {
    try {
      if (!pythonService.isReady()) {
        return {
          success: false,
          error: 'Python service not ready'
        };
      }

      const info = pythonService.getPythonInfo();
      const versionCommand = 'import sys; print(f"Python {sys.version}")';
      const pathCommand = 'import sys; print(f"Executable: {sys.executable}")';
      
      const versionResult = pythonService.executePythonCommand(versionCommand);
      const pathResult = pythonService.executePythonCommand(pathCommand);
      
      // Get griptape-nodes info
      const griptapeNodesPath = pythonService.getGriptapeNodesPath();
      const griptapeNodesVersion = pythonService.isGriptapeNodesReady() ? pythonService.getGriptapeNodesVersion() : 'Not available';
      
      return {
        success: true,
        version: info.version,
        executable: info.executable,
        versionOutput: versionResult.success ? versionResult.stdout.trim() : 'Failed to get version',
        pathOutput: pathResult.success ? pathResult.stdout.trim() : 'Failed to get path',
        griptapeNodesPath: griptapeNodesPath || 'Not found',
        griptapeNodesVersion: griptapeNodesVersion
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle Auth Logout
  ipcMain.handle('auth:logout', async () => {
    authService.clearCredentials();
    
    // Notify all windows about logout
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('auth:logout-success');
    });
    
    return { success: true };
  });

  // Check if user is already authenticated
  ipcMain.handle('auth:check', async () => {
    const credentials = authService.getStoredCredentials();
    if (credentials) {
      return {
        isAuthenticated: true,
        ...credentials
      };
    }
    return {
      isAuthenticated: false
    };
  });

  // Handle Auth Login
  ipcMain.handle('auth:login', async () => {
    try {
      const result = await authService.login();
      
      // Send success event to all windows
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('auth:login-success', result);
      });
      
      return result;
    } catch (error) {
      // Send error event to all windows
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('auth:login-error', error.message);
      });
      
      throw error;
    }
  });

  // Handle environment variable requests
  ipcMain.handle('get-env-var', (event, key: string) => {
    return process.env[key] || null;
  });

  // Handle development environment check
  ipcMain.handle('is-development', () => {
    return process.env.NODE_ENV === 'development' || !app.isPackaged;
  });
};

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
