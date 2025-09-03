import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { Worker } from 'worker_threads';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { PythonService } from './services/python';
import { AsyncPythonService } from './services/python/async-service';
import { EnvironmentSetupService } from './services/environment-setup';
import { GriptapeNodesService } from './services/griptape-nodes';
import { EngineService } from './services/engine';
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

// Set userData path for development
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  const devUserDataPath = path.join(app.getAppPath(), '.dev-user-data');
  app.setPath('userData', devUserDataPath);
  console.log('Development mode: userData set to', devUserDataPath);
}

// Register custom URL scheme for OAuth callback
const OAUTH_SCHEME = 'gtn';
if (!app.isDefaultProtocolClient(OAUTH_SCHEME)) {
  app.setAsDefaultProtocolClient(OAUTH_SCHEME);
}

// Get resource path based on whether app is packaged
// process.resourcesPath is available immediately in packaged apps
const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
console.log('Initializing with resourcesPath:', resourcesPath);
console.log('app.isPackaged:', app.isPackaged);
console.log('process.resourcesPath:', process.resourcesPath);

// Initialize services with proper paths
const pythonService = new PythonService(resourcesPath);
const asyncPythonService = new AsyncPythonService(resourcesPath);
const environmentSetupService = new EnvironmentSetupService(pythonService, app.getPath('userData'), resourcesPath);

// Get paths for GriptapeNodesService
const configDir = path.join(resourcesPath, 'griptape-config');
const workspaceDir = path.join(app.getPath('documents'), 'GriptapeNodes');

const griptapeNodesService = new GriptapeNodesService(pythonService, configDir, workspaceDir);
const engineService = new EngineService(pythonService, griptapeNodesService, resourcesPath);
// Check for invalid configuration
if (process.env.NODE_ENV === 'development' && process.env.AUTH_SCHEME === 'custom') {
  throw new Error('Custom URL scheme authentication requires packaging. Custom URL schemes do not work in development mode on macOS and Windows. Please use AUTH_SCHEME=http for development or package the application.');
}

const authService = (process.env.AUTH_SCHEME === 'custom')
  ? new CustomAuthService()
  : new HttpAuthService();

authService.start();

const startBackgroundSetup = () => {
  console.log('[INIT] Starting background setup worker...');
  console.log('Starting background setup...');
  
  // The worker is compiled to worker.js in the same directory as main.js
  const setupWorker = new Worker(path.join(__dirname, 'worker.js'), {
    workerData: {
      userDataPath: app.getPath('userData'),
      resourcesPath: resourcesPath
    }
  });
  
  setupWorker.on('message', async (message) => {
    console.log('[WORKER] Received message:', message.type, message.message);
    if (message.type === 'success' || message.type === 'partial') {
      console.log('[WORKER] Background setup completed:', message.message);
      
      // Now that griptape-nodes is installed, check if we need to initialize it with API key
      console.log('[WORKER] Checking griptape-nodes config...');
      const existingConfig = griptapeNodesService.loadConfig();
      console.log('[WORKER] Existing config:', existingConfig ? 'Found' : 'Not found', existingConfig?.api_key ? 'with API key' : 'without API key');
      if (!existingConfig || !existingConfig.api_key) {
        // Try to initialize with stored credentials if available
        const credentials = authService.getStoredCredentials();
        console.log('[WORKER] Stored credentials:', credentials ? 'Found' : 'Not found');
        if (credentials && credentials.apiKey) {
          console.log('[WORKER] Initializing griptape-nodes with stored API key after installation...');
          const initResult = await griptapeNodesService.initialize({
            apiKey: credentials.apiKey
          });
          
          if (!initResult.success) {
            console.error('[WORKER] Failed to initialize griptape-nodes after installation:', initResult.error);
            return;
          }
        } else {
          console.log('[WORKER] No API key available to initialize griptape-nodes after installation');
          return;
        }
      }
      
      // Now check if we need to initialize the engine
      const currentStatus = engineService.getStatus();
      console.log('[WORKER] Current engine status:', currentStatus);
      if (currentStatus === 'not-ready') {
        // Re-check the status since griptape-nodes should now be installed and initialized
        console.log('[WORKER] Calling engineService.initialize()...');
        await engineService.initialize();
        console.log('[WORKER] Engine initialized after background setup completion');
      }
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
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 20, y: 18 } : undefined,
    frame: process.platform !== 'darwin' ? false : true,
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

  // Set up IPC handlers (function handles its own initialization state)
  setupIPC();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  console.log('[INIT] App ready event fired');
  createWindow();
  
  // Debug: Check resource paths
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('process.resourcesPath:', process.resourcesPath);
  console.log('process.cwd():', process.cwd());
  console.log('app.getAppPath():', app.getAppPath());
  
  // Start post-install setup in background thread
  startBackgroundSetup();
  
  // Check if we have stored credentials and initialize griptape-nodes if needed
  const initializeGriptapeNodes = async () => {
    console.log('[INIT] Checking for existing griptape-nodes initialization...');
    try {
      // First check if gtn is already initialized with saved config
      const existingConfig = griptapeNodesService.loadConfig();
      console.log('[INIT] Existing gtn config:', existingConfig ? 'Found' : 'Not found');
      if (existingConfig && existingConfig.api_key) {
        console.log('[INIT] Griptape-nodes already initialized with saved config');
        return;
      }
      
      // If not initialized, check if we have stored credentials to initialize with
      const credentials = authService.getStoredCredentials();
      console.log('[INIT] Stored credentials check:', credentials ? 'Found' : 'Not found', credentials?.apiKey ? 'with API' : 'without API');
      if (credentials && credentials.apiKey) {
        console.log('Found stored API key, initializing griptape-nodes...');
        
        const initResult = await griptapeNodesService.initialize({
          apiKey: credentials.apiKey
        });
        
        if (!initResult.success) {
          console.error('Failed to initialize griptape-nodes:', initResult.error);
        } else {
          console.log('Successfully initialized griptape-nodes on startup');
        }
      } else {
        console.log('No stored API key found, skipping griptape-nodes initialization');
      }
    } catch (error) {
      console.error('Error during startup griptape-nodes initialization:', error);
    }
  };
  
  // Initialize griptape-nodes if we have credentials
  console.log('[INIT] Running initializeGriptapeNodes...');
  await initializeGriptapeNodes();
  
  // Only try to initialize engine if griptape-nodes is already installed
  // Otherwise, the background worker will initialize it when installation completes
  const gtnReady = pythonService.isGriptapeNodesReady();
  const gtnInitialized = griptapeNodesService.isInitialized();
  console.log('[INIT] Griptape-nodes ready:', gtnReady, 'Initialized:', gtnInitialized);
  if (gtnReady && gtnInitialized) {
    console.log('[INIT] Calling engineService.initialize() from app ready...');
    engineService.initialize().catch(error => {
      console.error('[INIT] Failed to initialize engine service:', error);
    });
  } else {
    console.log('[INIT] Deferring engine initialization until griptape-nodes is ready');
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await engineService.destroy();
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
  // Load persisted environment info
  const envInfo = environmentSetupService.loadEnvironmentInfo();
  
  let detailText = [
    `Version: ${__BUILD_INFO__.version}`,
    `Commit: ${__BUILD_INFO__.commitHash.substring(0, 8)}`,
    `Branch: ${__BUILD_INFO__.branch}`,
    `Build Date: ${new Date(__BUILD_INFO__.buildDate).toLocaleString()}`,
    '',
    `Platform: ${process.platform} (${process.arch})`,
    `Electron: ${process.versions.electron}`,
    `Chrome: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`,
    ''
  ];

  if (envInfo) {
    // Use persisted environment info
    detailText.push(
      `Python: ${envInfo.python.version.split('\n')[0]}`,
      `UV: ${envInfo.uv.version}`,
      `Griptape Nodes: ${envInfo.griptapeNodes.installed ? envInfo.griptapeNodes.version : 'Not installed'}`
    );
  } else {
    // Fallback to direct service calls if no persisted info
    detailText.push(
      `Python: ${pythonService.getBundledPythonVersion()}`,
      `UV: ${pythonService.getUvVersion()}`,
      `Griptape Nodes: ${pythonService.isGriptapeNodesReady() ? pythonService.getGriptapeNodesVersion() : 'Not installed'}`
    );
  }

  dialog.showMessageBox({
    type: 'info',
    title: `About ${app.getName()}`,
    message: app.getName(),
    detail: detailText.join('\n'),
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

let ipcInitialized = false;

const setupIPC = () => {
  // Only set up IPC handlers once
  if (ipcInitialized) {
    return;
  }
  ipcInitialized = true;
  
  let mainWindow: BrowserWindow | null = null;
  
  // Store reference to main window for sending events
  BrowserWindow.getAllWindows().forEach(window => {
    if (!mainWindow) mainWindow = window;
  });

  // Handle environment info requests (from persisted data)
  ipcMain.handle('get-environment-info', async () => {
    try {
      const envInfo = environmentSetupService.loadEnvironmentInfo();
      
      if (envInfo) {
        return {
          success: true,
          data: envInfo
        };
      } else {
        return {
          success: false,
          error: 'Environment info not yet collected'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle environment info refresh requests
  ipcMain.handle('refresh-environment-info', async () => {
    try {
      const envInfo = await environmentSetupService.refreshEnvironmentInfo();
      return {
        success: true,
        data: envInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle Python info requests (legacy compatibility)
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
      
      // Initialize griptape-nodes with the API key after successful login
      if (result.success && result.apiKey) {
        // Check if already initialized with this API key
        const existingConfig = griptapeNodesService.loadConfig();
        if (existingConfig && existingConfig.api_key === result.apiKey) {
          console.log('Griptape-nodes already initialized with this API key');
        } else {
          console.log('Initializing griptape-nodes with API key...');
          const initResult = await griptapeNodesService.initialize({
            apiKey: result.apiKey
          });
          
          if (!initResult.success) {
            console.error('Failed to initialize griptape-nodes:', initResult.error);
            // Don't fail the login, just log the error
          } else {
            console.log('Successfully initialized griptape-nodes');
          }
        }
        
        // Try to start the engine after login
        engineService.initialize().catch(error => {
          console.error('Failed to initialize engine after login:', error);
        });
      }
      
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

  // Handle opening external links
  ipcMain.handle('open-external', async (event, url: string) => {
    await shell.openExternal(url);
  });

  // Engine Service handlers
  ipcMain.handle('engine:get-status', () => {
    return engineService.getStatus();
  });

  ipcMain.handle('engine:get-logs', () => {
    return engineService.getLogs();
  });

  ipcMain.handle('engine:clear-logs', () => {
    engineService.clearLogs();
    return { success: true };
  });

  ipcMain.handle('engine:start', async () => {
    try {
      await engineService.start();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('engine:stop', async () => {
    try {
      await engineService.stop();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('engine:restart', async () => {
    try {
      await engineService.restart();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Set up engine event listeners to notify renderer
  // First remove any existing listeners to prevent duplicates
  engineService.removeAllListeners('status-changed');
  engineService.removeAllListeners('log');
  
  engineService.on('status-changed', (status) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('engine:status-changed', status);
    });
  });

  engineService.on('log', (log) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('engine:log', log);
    });
  });

  // Griptape Nodes configuration handlers
  ipcMain.handle('gtn:get-workspace', () => {
    return griptapeNodesService.getWorkspaceDirectory();
  });

  ipcMain.handle('gtn:set-workspace', async (event, directory: string) => {
    try {
      const result = await griptapeNodesService.updateWorkspaceDirectory(directory);
      
      if (result.success) {
        // Restart engine if it was running
        if (engineService.getStatus() === 'running') {
          await engineService.restart();
        }
      }
      
      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('gtn:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Workspace Directory'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });
};

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
