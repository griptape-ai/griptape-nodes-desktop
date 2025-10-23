import { VelopackApp } from 'velopack'

// Velopack builder needs to be the first thing to run in the main process.
// In some cases, it might quit/restart the process to perform tasks.
VelopackApp.build().run()

import path from 'node:path'
import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import contextMenu from 'electron-context-menu'
import { getPythonVersion } from '../common/config/versions'
import { ENV_INFO_NOT_COLLECTED } from '../common/config/constants'
import { HttpAuthService } from '../common/services/auth/http'
import { EngineService } from '../common/services/gtn/engine-service'
import { EnvironmentInfoService } from '../common/services/environment-info'
import { GtnService } from '../common/services/gtn/gtn-service'
import { UvService } from '../common/services/uv/uv-service'
import { logger } from '@/main/utils/logger'
import { isPackaged } from '@/main/utils/is-packaged'
import { PythonService } from '../common/services/python/python-service'
import { UpdateService } from '../common/services/update/update-service'
import { OnboardingService } from '../common/services/onboarding-service'
import { UsageMetricsService } from '../common/services/usage-metrics-service'
import { DeviceIdService } from '../common/services/device-id-service'
import { SystemMonitorService } from '../common/services/system-monitor-service'
import { SettingsService } from '../common/services/settings-service'

declare const MAIN_WINDOW_WEBPACK_ENTRY: string
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string
declare const WEBVIEW_PRELOAD_PRELOAD_WEBPACK_ENTRY: string

// Build info injected at compile time
declare const __BUILD_INFO__: {
  version: string
  commitHash: string
  commitDate: string
  branch: string
  buildDate: string
  buildId: string
}

declare const __VELOPACK_CHANNEL__: string | undefined

app.setAppUserModelId('ai.griptape.nodes.desktop')

logger.info('app.isPackaged:', app.isPackaged)
logger.info('isPackaged():', isPackaged())
logger.info('__dirname:', __dirname)

// Set userData path for development
if (!isPackaged()) {
  const devUserDataPath = path.join(app.getAppPath(), '_userdata')
  app.setPath('userData', devUserDataPath)
  logger.info('Development mode: userData set to', devUserDataPath)

  const devDocumentsPath = path.join(app.getAppPath(), '_documents')
  app.setPath('documents', devDocumentsPath)
  logger.info('Development mode: documents set to', devDocumentsPath)

  const devLogsPath = path.join(app.getAppPath(), '_logs')
  app.setPath('logs', devLogsPath)
  logger.info('Development mode: logs set to', devLogsPath)
}

// Initialize services with proper paths
const userDataPath = app.getPath('userData')
const gtnDefaultWorkspaceDir = path.join(app.getPath('documents'), 'GriptapeNodes')

// Register custom URL scheme for OAuth callback
const OAUTH_SCHEME = 'gtn'
if (!app.isDefaultProtocolClient(OAUTH_SCHEME)) {
  app.setAsDefaultProtocolClient(OAUTH_SCHEME)
}
if (!isPackaged() && process.env.AUTH_SCHEME === 'custom') {
  throw new Error(
    'Custom URL scheme authentication requires packaging. Custom URL schemes do not work in development mode on macOS and Windows. Please use AUTH_SCHEME=http for development or package the application.'
  )
}

// Services
const onboardingService = new OnboardingService()
const deviceIdService = new DeviceIdService()
const usageMetricsService = new UsageMetricsService()
const settingsService = new SettingsService()
const systemMonitorService = new SystemMonitorService()
const uvService = new UvService(userDataPath)
const environmentInfoService = new EnvironmentInfoService(userDataPath)
const pythonService = new PythonService(userDataPath, uvService)

// Initialize auth service without persistence - it will be enabled via enablePersistence() when needed
const authService = new HttpAuthService()
// const authService = (process.env.AUTH_SCHEME === 'custom')
//   ? new CustomAuthService()
//   : new HttpAuthService();
const gtnService = new GtnService(
  userDataPath,
  gtnDefaultWorkspaceDir,
  uvService,
  pythonService,
  authService
)
const engineService = new EngineService(userDataPath, gtnService)
const updateService = new UpdateService(isPackaged())

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1200,
    minWidth: 1280,
    minHeight: 800,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 20, y: 18 } : undefined,
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      webviewTag: true,
      // contextIsolation: true,
      partition: 'main' // Non-persistent partition - no keychain prompt
    }
  })

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  // Open the DevTools in development only
  if (!isPackaged()) {
    mainWindow.webContents.openDevTools()
  }

  // Set up IPC handlers (function handles its own initialization state and returns current page getter)
  const getCurrentPage = setupIPC()

  // Set up application menu with current page getter
  createMenu(getCurrentPage)

  // Enable keyboard shortcuts for copy/paste
  setupKeyboardShortcuts(mainWindow)

  // Start engine when window is created (if ready)
  if (engineService.getStatus() === 'ready') {
    engineService.startEngine()
  }

  // Stop engine when window is closed
  mainWindow.on('closed', () => {
    // Ensure the async stopEngine completes properly
    ;(async () => {
      await engineService.stopEngine()
    })()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // Set engine service reference in GtnService so it can forward initialization logs
  gtnService.setEngineService(engineService)

  // Set engine to initializing state before GTN setup
  engineService.setInitializing()

  onboardingService.start()
  deviceIdService.start()
  usageMetricsService.start()
  settingsService.start()
  systemMonitorService.start()
  authService.start()
  uvService.start()
  pythonService.start()
  gtnService.start()
  engineService.start()

  engineService.on('engine:status-changed', (status) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('engine:status-changed', status)
    })
  })

  engineService.on('engine:log', (log) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('engine:log', log)
    })
  })

  gtnService.on('workspace-changed', (directory) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('workspace-changed', directory)
    })
  })

  // Enable context menus for webviews (including right-click on images)
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      contextMenu({
        window: contents,
        showSaveImageAs: true,
        showCopyImage: true,
        showCopyImageAddress: true,
        showInspectElement: !isPackaged()
      })
    }
  })

  createWindow()

  engineService.startEngine()

  // Collect environment info after all services are ready (async in background)
  ;(async () => {
    try {
      await gtnService.waitForReady()
      await environmentInfoService.collectEnvironmentInfo(
        {
          pythonService,
          uvService,
          gtnService
        },
        __BUILD_INFO__
      )
      logger.info('Initial environment info collection completed')
    } catch (error) {
      logger.error('Failed to collect initial environment info:', error)
    }
  })()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await engineService.destroy()
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Ensure only one instance of the app runs
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

const checkForUpdatesWithDialog = async (browserWindow?: BrowserWindow) => {
  if (!updateService.isUpdateSupported()) {
    logger.info('UpdateService: Updates not supported in development mode')
    if (browserWindow) {
      dialog.showMessageBox(browserWindow, {
        type: 'info',
        message: 'Updates not available',
        detail: 'Updates are not available in development mode.'
      })
    }
    return
  }

  try {
    const updateManager = updateService.getUpdateManager()
    const updateInfo = await updateManager.checkForUpdatesAsync()

    if (!updateInfo) {
      logger.info('UpdateService: No updates available')
      if (browserWindow) {
        dialog.showMessageBox(browserWindow, {
          type: 'info',
          message: "You're up to date",
          detail: `Version ${updateService.getCurrentVersion()}`
        })
      }
      return
    }

    logger.info('UpdateService: Update available', updateInfo.TargetFullRelease.Version)

    const { response } = await dialog.showMessageBox(
      browserWindow || BrowserWindow.getAllWindows()[0],
      {
        type: 'info',
        buttons: ['Download and Install', 'Later'],
        defaultId: 0,
        title: 'Application Update Available',
        message: `Version ${updateInfo.TargetFullRelease.Version} is available`,
        detail: 'Would you like to download and install it now?'
      }
    )

    if (response === 0) {
      await downloadAndInstallUpdateWithDialog(updateInfo, browserWindow)
    }
  } catch (error) {
    logger.error('UpdateService: Failed to check for updates', error)
    if (browserWindow) {
      dialog.showMessageBox(browserWindow, {
        type: 'error',
        message: 'Update Check Failed',
        detail: `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }
}

const downloadAndInstallUpdateWithDialog = async (
  updateInfo: any,
  browserWindow?: BrowserWindow
) => {
  const updateManager = updateService.getUpdateManager()

  logger.info('UpdateService: Downloading update...')

  // Emit download start event
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('update:download-started')
  })

  await updateManager.downloadUpdateAsync(updateInfo, (progress) => {
    logger.info(`Download progress: ${progress}%`)
    // Emit progress to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:download-progress', progress)
    })
  })

  logger.info('UpdateService: Update downloaded, prompting for restart')

  // Emit download complete event
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('update:download-complete')
  })

  const { response } = await dialog.showMessageBox(
    browserWindow || BrowserWindow.getAllWindows()[0],
    {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      title: 'Update Downloaded',
      message: 'The update has been downloaded.',
      detail: 'The application will restart to apply the update.'
    }
  )

  if (response === 0) {
    updateManager.waitExitThenApplyUpdate(updateInfo)
    app.quit()
  }
}

const createMenu = (getCurrentPage: () => string) => {
  const checkForUpdatesItem = {
    label: 'Check for Updates…',
    click: async () => {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      await checkForUpdatesWithDialog(focusedWindow || undefined)
    }
  }

  const aboutMenuItem = {
    label: `About ${app.getName()}`,
    click: async () => await showAboutDialog()
  }

  // Build template based on platform
  const template: any[] = []

  // macOS: Include app menu with About, Check for Updates, and Quit
  if (process.platform === 'darwin') {
    template.push({
      label: app.getName(),
      submenu: [
        aboutMenuItem,
        { type: 'separator' },
        checkForUpdatesItem,
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  // Edit menu (all platforms)
  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    ]
  })

  // View menu (all platforms)
  template.push({
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          const page = getCurrentPage()
          const focusedWindow = BrowserWindow.getFocusedWindow()

          if (page === 'editor' && focusedWindow) {
            // Reload only the webview when on editor page
            focusedWindow.webContents.send('editor:do-reload-webview')
          } else if (focusedWindow) {
            // Reload the entire app for other pages
            focusedWindow.reload()
          }
        }
      },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  })

  // Window menu (all platforms)
  template.push({
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' },
      ...(process.platform === 'darwin'
        ? [{ type: 'separator' as const }, { role: 'front' as const }]
        : [])
    ]
  })

  // Windows/Linux: Add Help menu with About and Check for Updates
  if (process.platform !== 'darwin') {
    template.push({
      label: 'Help',
      submenu: [aboutMenuItem, { type: 'separator' }, checkForUpdatesItem]
    })
  }

  const menu = Menu.buildFromTemplate(template as any)
  Menu.setApplicationMenu(menu)
}

const showAboutDialog = async () => {
  // Load persisted environment info
  const envInfo = environmentInfoService.loadEnvironmentInfo()

  // Use build info from environment info, fallback to __BUILD_INFO__
  const buildInfo = envInfo?.build || __BUILD_INFO__

  const detailText = [
    `Version: ${buildInfo.version}`,
    `Commit: ${buildInfo.commitHash.substring(0, 8)}`,
    `Branch: ${buildInfo.branch}`,
    `Build ID: ${buildInfo.buildId}`,
    `Build Date: ${new Date(buildInfo.buildDate).toLocaleString()}`,
    '',
    `Platform: ${process.platform} (${process.arch})`,
    `Electron: ${process.versions.electron}`,
    `Chrome: ${process.versions.chrome}`,
    `Node.js: ${process.versions.node}`,
    ''
  ]

  // Python information
  const pythonVersion =
    envInfo?.python?.version?.split('\n')?.[0] || getPythonVersion() || 'Not installed'
  const pythonExecutable = envInfo?.python?.executable || 'Unknown'
  const pythonPackagesCount = envInfo?.python?.installedPackages?.length || 0

  detailText.push(
    `Python: ${pythonVersion}`,
    `Python Executable: ${pythonExecutable}`,
    `Python Packages: ${pythonPackagesCount} installed`,
    ''
  )

  // UV information
  const uvVersion = envInfo?.uv?.version || (await uvService.getUvVersion()) || 'Not installed'
  const uvToolDir = envInfo?.uv?.toolDir || 'Unknown'
  const uvPythonInstallDir = envInfo?.uv?.pythonInstallDir || 'Unknown'

  detailText.push(
    `UV: ${uvVersion}`,
    `UV Tool Directory: ${uvToolDir}`,
    `UV Python Install Directory: ${uvPythonInstallDir}`,
    ''
  )

  // Griptape Nodes information
  const gtnVersion = envInfo?.griptapeNodes?.version || 'Not installed'
  const gtnPath = envInfo?.griptapeNodes?.path || 'Unknown'
  const gtnInstalled = envInfo?.griptapeNodes?.installed ? 'Yes' : 'No'

  detailText.push(
    `Griptape Nodes: ${gtnVersion}`,
    `GTN Path: ${gtnPath}`,
    `GTN Installed: ${gtnInstalled}`,
    ''
  )

  // Collection metadata
  if (envInfo?.collectedAt) {
    const collectedDate = new Date(envInfo.collectedAt).toLocaleString()
    detailText.push(`Environment Info Collected: ${collectedDate}`, '')
  }

  // Show errors if any
  if (envInfo?.errors && envInfo.errors.length > 0) {
    detailText.push('Collection Errors:')
    envInfo.errors.forEach((error) => {
      detailText.push(`  - ${error}`)
    })
  }

  dialog.showMessageBox({
    type: 'info',
    title: `About ${app.getName()}`,
    message: app.getName(),
    detail: detailText.join('\n'),
    buttons: ['OK']
  })
}

const setupKeyboardShortcuts = (mainWindow: BrowserWindow) => {
  // Set up right-click context menu
  mainWindow.webContents.on('context-menu', (_event, _params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    ])
    menu.popup({ window: mainWindow })
  })
}

let ipcInitialized = false

const setupIPC = () => {
  // Only set up IPC handlers once
  if (ipcInitialized) {
    return () => 'dashboard'
  }
  ipcInitialized = true

  let mainWindow: BrowserWindow | null = null
  let currentPage = 'dashboard'

  // Store reference to main window for sending events
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!mainWindow) mainWindow = window
  })

  ipcMain.handle('velopack:get-version', () => {
    return updateService.getCurrentVersion()
  })

  ipcMain.handle('velopack:check-for-update', async () => {
    if (!updateService.isUpdateSupported()) {
      return null
    }
    const updateManager = updateService.getUpdateManager()
    return await updateManager.checkForUpdatesAsync()
  })

  ipcMain.handle('velopack:download-update', async (_, updateInfo) => {
    if (!updateService.isUpdateSupported()) {
      throw new Error('Updates not supported in development mode')
    }
    const updateManager = updateService.getUpdateManager()

    // Emit download start event
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:download-started')
    })

    await updateManager.downloadUpdateAsync(updateInfo, (progress) => {
      console.log(`Download progress: ${progress}%`)
      // Emit progress to all windows
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('update:download-progress', progress)
      })
    })

    // Emit download complete event
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:download-complete')
    })

    return true
  })

  ipcMain.handle('velopack:apply-update', async (_, updateInfo) => {
    if (!updateService.isUpdateSupported()) {
      throw new Error('Updates not supported in development mode')
    }
    const updateManager = updateService.getUpdateManager()
    updateManager.waitExitThenApplyUpdate(updateInfo)
    app.quit()
    return true
  })

  ipcMain.handle('velopack:get-channel', () => {
    return updateService.getChannel()
  })

  ipcMain.handle('velopack:set-channel', (_, channel: string) => {
    if (!updateService.isUpdateSupported()) {
      throw new Error('Cannot set channel in development mode')
    }
    updateService.setChannel(channel)
    return true
  })

  ipcMain.handle('velopack:get-available-channels', () => {
    return updateService.getAvailableChannels()
  })

  ipcMain.handle('velopack:get-logical-channel-name', (_, channel: string) => {
    return updateService.getLogicalChannelName(channel)
  })

  ipcMain.on('get-preload-path', (e) => {
    e.returnValue = MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
  })

  ipcMain.on('get-webview-preload-path', (e) => {
    const preloadPath = WEBVIEW_PRELOAD_PRELOAD_WEBPACK_ENTRY
    // Ensure the path has the file:// protocol
    const fileUrl = preloadPath.startsWith('file://') ? preloadPath : `file://${preloadPath}`
    e.returnValue = fileUrl
  })

  // Handle environment info requests (from persisted data)
  ipcMain.handle('get-environment-info', async () => {
    try {
      const envInfo = environmentInfoService.loadEnvironmentInfo()

      if (envInfo) {
        return {
          success: true,
          data: envInfo
        }
      } else {
        return {
          success: false,
          error: ENV_INFO_NOT_COLLECTED
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Handle environment info collection
  ipcMain.handle('collect-environment-info', async () => {
    try {
      const envInfo = await environmentInfoService.collectEnvironmentInfo(
        {
          pythonService,
          uvService,
          gtnService
        },
        __BUILD_INFO__
      )

      return {
        success: true,
        data: envInfo
      }
    } catch (error) {
      logger.error('Failed to collect environment info:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Handle environment info refresh (alias for collect)
  ipcMain.handle('refresh-environment-info', async () => {
    try {
      const envInfo = await environmentInfoService.collectEnvironmentInfo(
        {
          pythonService,
          uvService,
          gtnService
        },
        __BUILD_INFO__
      )

      return {
        success: true,
        data: envInfo
      }
    } catch (error) {
      logger.error('Failed to refresh environment info:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Handle Auth Logout
  ipcMain.handle('auth:logout', async () => {
    authService.clearCredentials()

    // Reset credential storage preference
    onboardingService.setCredentialStorageEnabled(false)

    return { success: true }
  })

  // Check if user is already authenticated
  ipcMain.handle('auth:check', async () => {
    // Always check for credentials in current session, regardless of persistence preference
    const credentials = authService.getStoredCredentials()

    if (credentials) {
      // Check if token is expired or missing expiration time
      const currentTime = Math.floor(Date.now() / 1000)
      if (!credentials.expiresAt || currentTime >= credentials.expiresAt) {
        // Token is expired or has no expiration time - return credentials anyway
        // so the renderer can attempt to refresh using the refresh_token
        logger.warn(
          'auth:check - Token is expired or missing expiration time, returning credentials for refresh attempt'
        )
        return {
          isAuthenticated: true,
          ...credentials
        }
      }
      return {
        isAuthenticated: true,
        ...credentials
      }
    }
    return {
      isAuthenticated: false
    }
  })

  // Synchronous auth check for webview preload
  ipcMain.on('auth:check-sync', (event) => {
    const credentials = authService.getStoredCredentials()
    if (credentials) {
      // Check if token is expired or missing expiration time
      const currentTime = Math.floor(Date.now() / 1000)
      if (!credentials.expiresAt || currentTime >= credentials.expiresAt) {
        // Token is expired or has no expiration time - don't return it
        logger.warn(
          'auth:check-sync - Token is expired or missing expiration time, treating as not authenticated'
        )
        event.returnValue = {
          isAuthenticated: false
        }
      } else {
        event.returnValue = {
          isAuthenticated: true,
          ...credentials
        }
      }
    } else {
      event.returnValue = {
        isAuthenticated: false
      }
    }
  })

  // Handle Auth Login
  ipcMain.handle('auth:login', () => authService.login())

  // Handle Auth Token Refresh
  ipcMain.handle('auth:refresh-token', async (event, refreshToken: string) => {
    return await authService.refreshTokens(refreshToken)
  })

  // Handle environment variable requests
  ipcMain.handle('get-env-var', (event, key: string) => {
    return process.env[key] || null
  })

  // Handle packaged app check
  ipcMain.handle('is-packaged', () => {
    return isPackaged()
  })

  // Handle opening external links
  ipcMain.handle('open-external', async (event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('get-platform', () => {
    return process.platform
  })

  ipcMain.handle('app:restart', () => {
    app.relaunch()
    app.quit()
  })

  ipcMain.on('app:set-current-page', (event, page: string) => {
    currentPage = page
  })

  // Engine Service handlers
  ipcMain.handle('engine:get-status', () => {
    return engineService.getStatus()
  })

  ipcMain.handle('engine:get-logs', () => {
    return engineService.getLogs()
  })

  ipcMain.handle('engine:clear-logs', () => {
    engineService.clearLogs()
    return { success: true }
  })

  ipcMain.handle('engine:start', async () => {
    try {
      await engineService.startEngine()
      return { success: true }
    } catch (error) {
      logger.error('Failed to start engine:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('engine:stop', async () => {
    try {
      await engineService.stopEngine()
      return { success: true }
    } catch (error) {
      logger.error('Failed to stop engine:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('engine:restart', async () => {
    try {
      await engineService.restartEngine()
      return { success: true }
    } catch (error) {
      logger.error('Failed to restart engine:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Editor webview handlers
  ipcMain.on('editor:reload-webview', (event) => {
    // Send reload command back to the same window
    event.sender.send('editor:do-reload-webview')
  })

  // Griptape Nodes configuration handlers
  ipcMain.handle('gtn:get-workspace', async () => {
    await gtnService.waitForReady()
    return gtnService.workspaceDirectory
  })

  ipcMain.handle('gtn:get-default-workspace', () => {
    return gtnDefaultWorkspaceDir
  })

  ipcMain.handle('gtn:set-workspace-preference', (event, directory: string) => {
    gtnService.workspaceDirectory = directory
  })

  ipcMain.handle('gtn:set-workspace', async (event, directory: string) => {
    await gtnService.updateWorkspaceDirectory(directory)
    engineService.restartEngine()
  })

  ipcMain.handle('gtn:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Workspace Directory'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('gtn:refresh-config', () => gtnService.refreshConfig())

  ipcMain.handle('gtn:upgrade', async () => {
    try {
      await gtnService.upgradeGtn()
      return { success: true }
    } catch (error) {
      logger.error('Failed to upgrade GTN:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('gtn:get-version', async () => {
    try {
      await gtnService.waitForReady()
      const version = await gtnService.getGtnVersion()
      return { success: true, version: version.trim() }
    } catch (error) {
      logger.error('Failed to get GTN version:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Update service handlers
  ipcMain.handle('update:check', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    await checkForUpdatesWithDialog(focusedWindow || undefined)
    return { success: true }
  })

  ipcMain.handle('update:is-supported', () => {
    return updateService.isUpdateSupported()
  })

  // Onboarding service handlers
  ipcMain.handle('onboarding:is-complete', () => {
    return onboardingService.isOnboardingComplete()
  })

  ipcMain.handle('onboarding:is-credential-storage-enabled', () => {
    return onboardingService.isCredentialStorageEnabled()
  })

  ipcMain.handle('onboarding:complete', async (_event, _credentialStorageEnabled: boolean) => {
    // Just mark onboarding as complete
    // Credential storage is now handled at login time, so we don't modify that setting here
    onboardingService.setOnboardingComplete(true)

    return { success: true }
  })

  ipcMain.handle('onboarding:reset', () => {
    onboardingService.resetOnboarding()
    return { success: true }
  })

  ipcMain.handle('onboarding:set-credential-storage-preference', (event, enabled: boolean) => {
    onboardingService.setCredentialStorageEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('onboarding:enable-credential-storage', () => {
    authService.enablePersistence()
    onboardingService.setCredentialStorageEnabled(true)
    onboardingService.setKeychainAccessGranted(true)
    return { success: true }
  })

  ipcMain.handle('auth:load-from-persistent-store', () => {
    authService.loadFromPersistentStore()
    return { success: true }
  })

  ipcMain.handle('onboarding:is-keychain-verification-seen', () => {
    return onboardingService.isKeychainVerificationSeen()
  })

  ipcMain.handle('onboarding:set-keychain-verification-seen', (event, seen: boolean) => {
    onboardingService.setKeychainVerificationSeen(seen)
    return { success: true }
  })

  ipcMain.handle('onboarding:is-workspace-setup-complete', () => {
    return onboardingService.isWorkspaceSetupComplete()
  })

  ipcMain.handle('onboarding:set-workspace-setup-complete', (event, complete: boolean) => {
    onboardingService.setWorkspaceSetupComplete(complete)
    return { success: true }
  })

  // Test encryption to trigger keychain prompt immediately
  ipcMain.handle('onboarding:test-encryption', async () => {
    try {
      // Import safeStorage
      const { safeStorage } = await import('electron')

      // Check if encryption is available
      if (!safeStorage.isEncryptionAvailable()) {
        return {
          success: false,
          error: 'Encryption not available on this platform'
        }
      }

      // Try to encrypt a test string - this will trigger the keychain prompt
      const testString = 'test-encryption-access'
      const encrypted = safeStorage.encryptString(testString)

      // Try to decrypt to verify it worked
      const decrypted = safeStorage.decryptString(encrypted)

      if (decrypted !== testString) {
        return {
          success: false,
          error: 'Encryption test failed: decrypted value does not match'
        }
      }

      return { success: true }
    } catch (error) {
      logger.error('Encryption test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encryption error'
      }
    }
  })

  // Auth service handlers for keychain detection
  ipcMain.handle('auth:will-prompt-keychain', () => {
    // NOTE: This is not ideal, but the best we can do with available APIs.
    //
    // What we'd ideally want: Direct query to macOS for "does this app have keychain permission?"
    // Why that's not possible: No such API exists in Electron or macOS that doesn't potentially
    // trigger the permission prompt itself.
    //
    // What we're doing instead: Inferring permission state from two passive signals:
    // 1. Does the encrypted store file exist? (filesystem check only)
    // 2. Have we successfully initialized the store before? (flag in non-encrypted store)
    //
    // This works well because:
    // - If either signal is true, keychain access was definitely granted before
    // - If both are false, we've never successfully accessed keychain (likely will prompt)
    // - We never call any Electron APIs that might trigger the prompt during detection
    //
    // Edge case: User manually deletes store file AND we reset the flag → Will see explanation
    // again, which is acceptable (better than skipping explanation when prompt will appear)

    const hasExistingStore = authService.hasExistingEncryptedStore()
    const hasAccessFlag = onboardingService.hasKeychainAccess()

    logger.info('Keychain detection:', { hasExistingStore, hasAccessFlag })

    // If store exists OR flag is set, we won't prompt (permission already granted)
    const willPrompt = !hasExistingStore && !hasAccessFlag

    return willPrompt
  })

  // Check if encrypted credentials store exists
  ipcMain.handle('auth:has-existing-encrypted-store', () => {
    return authService.hasExistingEncryptedStore()
  })

  // Usage metrics handlers
  ipcMain.handle('usage-metrics:report-launch', async () => {
    try {
      const credentials = authService.getStoredCredentials()
      if (!credentials?.tokens?.access_token) {
        return { success: false, error: 'Not authenticated' }
      }

      const deviceId = await deviceIdService.getDeviceId()
      await usageMetricsService.reportLaunch(credentials.tokens.access_token, deviceId)
      return { success: true }
    } catch (error) {
      logger.error('Failed to report launch usage:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Device ID handlers
  ipcMain.handle('device-id:get', async () => {
    try {
      const deviceId = await deviceIdService.getDeviceId()
      return { success: true, deviceId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('device-id:get-info', () => {
    const info = deviceIdService.getDeviceIdInfo()
    return { success: true, info }
  })

  ipcMain.handle('device-id:reset', () => {
    deviceIdService.resetDeviceId()
    return { success: true }
  })

  // Settings handlers
  ipcMain.handle('settings:get-show-system-monitor', () => {
    return settingsService.getShowSystemMonitor()
  })

  ipcMain.handle('settings:set-show-system-monitor', (_, show: boolean) => {
    settingsService.setShowSystemMonitor(show)
    return { success: true }
  })

  // System monitor handlers
  ipcMain.handle('system-monitor:get-metrics', async () => {
    try {
      const metrics = await systemMonitorService.getMetrics()
      return { success: true, metrics }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('system-monitor:start-monitoring', () => {
    systemMonitorService.startMonitoring()
    return { success: true }
  })

  ipcMain.handle('system-monitor:stop-monitoring', () => {
    systemMonitorService.stopMonitoring()
    return { success: true }
  })

  // Listen for metrics updates and forward to renderer
  systemMonitorService.on('metrics-update', (metrics) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('system-monitor:metrics-update', metrics)
    })
  })

  // Return getter function for current page
  return () => currentPage
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
