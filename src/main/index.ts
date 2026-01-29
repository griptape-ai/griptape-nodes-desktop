import { VelopackApp } from 'velopack'

// Velopack builder needs to be the first thing to run in the main process.
// In some cases, it might quit/restart the process to perform tasks.
VelopackApp.build().run()

import path from 'node:path'
import fs from 'node:fs'
import { ChildProcess } from 'node:child_process'
import {
  app,
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  dialog,
  ipcMain,
  shell,
  net,
  clipboard,
  webContents,
} from 'electron'
import { getPythonVersion } from '../common/config/versions'
import { getErrorMessage } from '../common/utils/error'
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
import { FakeEngineUpdateManager } from '../common/services/update/fake-update-manager'
import { OnboardingService } from '../common/services/onboarding-service'
import { UsageMetricsService } from '../common/services/usage-metrics-service'
import { DeviceIdService } from '../common/services/device-id-service'
import { SystemMonitorService } from '../common/services/system-monitor-service'
import { SettingsService } from '../common/services/settings-service'
import { EngineLogFileService } from '../common/services/engine-log-file-service'
import { MigrationService } from '../common/services/migration/migration-service'
import type { UpdateBehavior } from '@/types/global'

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

// Release notes injected at compile time
declare const __RELEASE_NOTES__: {
  version: string
  content: string
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
    'Custom URL scheme authentication requires packaging. Custom URL schemes do not work in development mode on macOS and Windows. Please use AUTH_SCHEME=http for development or package the application.',
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
const gtnService = new GtnService(
  userDataPath,
  gtnDefaultWorkspaceDir,
  uvService,
  pythonService,
  authService,
  onboardingService,
  settingsService,
)
const engineService = new EngineService(userDataPath, gtnService, settingsService)
const engineLogFileService = new EngineLogFileService(app.getPath('logs'), settingsService)
const updateService = new UpdateService(isPackaged())
const migrationService = new MigrationService(userDataPath)

/**
 * Builds context menu items for text editing with spell check support
 */
function buildEditContextMenu(
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents,
): Electron.MenuItemConstructorOptions[] {
  const menuItems: Electron.MenuItemConstructorOptions[] = []

  // Add spell check suggestions if available
  if (params.misspelledWord) {
    if (params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions) {
        menuItems.push({
          label: suggestion,
          click: () => webContents.replaceMisspelling(suggestion),
        })
      }
    } else {
      menuItems.push({
        label: 'No spelling suggestions',
        enabled: false,
      })
    }
    menuItems.push({ type: 'separator' })
  }

  // Standard edit menu items
  menuItems.push(
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { type: 'separator' },
    { role: 'selectAll' },
  )

  return menuItems
}

const createWindow = () => {
  // Platform-specific window configuration
  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1200,
    minWidth: 1280,
    minHeight: 800,
    // macOS: hiddenInset gives native traffic lights with inset content
    // Windows: hidden with titleBarOverlay for custom title bar with native controls
    // Linux: default frame
    titleBarStyle: isMac ? 'hiddenInset' : isWindows ? 'hidden' : 'default',
    // Windows only: overlay native window controls on top right
    ...(isWindows && {
      titleBarOverlay: {
        color: '#09090b',
        symbolColor: '#ffffff',
        height: 36,
      },
    }),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: true,
      webviewTag: true,
      // contextIsolation: true,
      partition: 'main', // Non-persistent partition - no keychain prompt
    },
  })

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)

  // Configure window.open to open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

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

  // Track if we're force closing (user confirmed, setting disabled, or app quitting)
  let forceClose = false

  // Prompt user before closing the window (only for user-initiated close button clicks)
  mainWindow.on('close', async (event) => {
    // Skip confirmation if:
    // - Already confirmed by user
    // - Setting is disabled
    // - App is being quit programmatically (Ctrl+C, app.quit(), etc.)
    // - Running in development mode (Ctrl+C is common)
    if (forceClose || !settingsService.getConfirmOnClose() || !isPackaged()) {
      return
    }

    // Prevent the window from closing immediately
    event.preventDefault()

    // Show confirmation dialog with "Don't ask again" checkbox
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Quit', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Confirm Exit',
      message: 'Are you sure you want to quit?',
      detail: 'The engine will be stopped and any unsaved work will be lost.',
      checkboxLabel: "Don't ask me again",
      checkboxChecked: false,
    })

    // If checkbox was checked, save the preference
    if (result.checkboxChecked) {
      settingsService.setConfirmOnClose(false)
    }

    // If user clicked "Quit" (index 0), close the window
    if (result.response === 0) {
      forceClose = true
      mainWindow.close()
    }
  })

  // Cleanup and quit when window is closed
  mainWindow.on('closed', () => {
    ;(async () => {
      await engineLogFileService.destroy()
      await engineService.destroy()
      app.quit()
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
  engineLogFileService.start()

  engineService.on('engine:status-changed', (status) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('engine:status-changed', status)
    })

    // Start new session log when engine starts
    if (status === 'running') {
      engineLogFileService.startNewSession()
    }
  })

  engineService.on('engine:log', (log) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('engine:log', log)
    })
    // Write log to file if enabled
    engineLogFileService.writeLog(log)
  })

  gtnService.on('workspace-changed', (directory) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('workspace-changed', directory)
    })
  })

  // Enable context menus for webviews (including right-click on images)
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      logger.info('[Webview] New webview created, setting up handlers')

      // Configure window.open to open in system browser
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
      })

      // Handle permission requests for camera, microphone, etc.
      contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = [
          'media',
          'mediaKeySystem',
          'fullscreen',
          'clipboard-sanitized-write',
          'clipboard-read',
        ]

        if (allowedPermissions.includes(permission)) {
          // Verify this is our trusted origin
          const url = webContents.getURL()
          const isGriptapeOrigin =
            url.includes('nodes.griptape.ai') || url.includes('app.nodes.griptape.ai')

          if (isGriptapeOrigin) {
            logger.info(
              `Auto-granting ${permission} permission for trusted Griptape origin: ${url}`,
            )
            callback(true)
          } else {
            logger.warn(`Denying ${permission} permission for untrusted origin: ${url}`)
            callback(false)
          }
        } else {
          logger.warn(`Denying ${permission} permission for webview`)
          callback(false)
        }
      })

      // Handle permission checks (runs before requests)
      contents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        const allowedPermissions = [
          'media',
          'mediaKeySystem',
          'fullscreen',
          'clipboard-sanitized-write',
          'clipboard-read',
        ]

        if (allowedPermissions.includes(permission)) {
          const isGriptapeOrigin =
            requestingOrigin.includes('nodes.griptape.ai') ||
            requestingOrigin.includes('app.nodes.griptape.ai')

          if (isGriptapeOrigin) {
            logger.debug(`Permission check passed for ${permission} from ${requestingOrigin}`)
            return true
          } else {
            logger.warn(`Permission check denied for ${permission} from ${requestingOrigin}`)
            return false
          }
        }

        return false
      })

      // Handle context menu for webviews manually to ensure image saving works
      contents.on('context-menu', (_event, params) => {
        const menuItems: Electron.MenuItemConstructorOptions[] = []

        // If right-clicking on an image, add image-specific options
        if (params.mediaType === 'image' && params.srcURL) {
          menuItems.push({
            label: 'Save Image As...',
            click: async () => {
              try {
                const imageUrl = params.srcURL
                const mainWindow = BrowserWindow.getAllWindows()[0]

                if (!mainWindow) {
                  logger.error('No main window found for save dialog')
                  return
                }

                // Extract filename from URL or use default
                const urlPath = new URL(imageUrl).pathname
                const defaultFilename = path.basename(urlPath) || 'image.png'

                // Show save dialog
                const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
                  defaultPath: defaultFilename,
                  filters: [
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
                    { name: 'All Files', extensions: ['*'] },
                  ],
                })

                if (canceled || !filePath) {
                  return
                }

                // Download the image
                logger.info('Downloading image from:', imageUrl, 'to:', filePath)

                const request = net.request(imageUrl)
                const chunks: Buffer[] = []

                request.on('response', (response) => {
                  response.on('data', (chunk) => {
                    chunks.push(Buffer.from(chunk))
                  })

                  response.on('end', () => {
                    const imageBuffer = Buffer.concat(chunks)
                    fs.writeFile(filePath, imageBuffer, (err: Error) => {
                      if (err) {
                        logger.error('Failed to save image:', err)
                        dialog.showErrorBox('Save Failed', `Failed to save image: ${err.message}`)
                      } else {
                        logger.info('Image saved successfully to:', filePath)
                      }
                    })
                  })
                })

                request.on('error', (err) => {
                  logger.error('Failed to download image:', err)
                  dialog.showErrorBox('Download Failed', `Failed to download image: ${err.message}`)
                })

                request.end()
              } catch (err) {
                logger.error('Error in Save Image As handler:', err)
                dialog.showErrorBox('Error', `An error occurred: ${err}`)
              }
            },
          })

          menuItems.push({
            label: 'Copy Image',
            click: () => {
              contents.copyImageAt(params.x, params.y)
            },
          })

          menuItems.push({
            label: 'Copy Image Address',
            click: () => {
              clipboard.writeText(params.srcURL)
            },
          })
        }

        // Add edit menu items (with spell check support) for text contexts
        if (params.isEditable || params.selectionText) {
          menuItems.push(...buildEditContextMenu(params, contents))
        }

        // Add reload option
        menuItems.push({
          label: 'Reload',
          click: () => {
            contents.reload()
          },
        })

        // Add inspect element in development mode
        if (!isPackaged()) {
          menuItems.push({ type: 'separator' })
          menuItems.push({
            label: 'Inspect Element',
            click: () => {
              contents.inspectElement(params.x, params.y)
            },
          })
        }

        // Only show menu if there are items
        if (menuItems.length > 0) {
          const menu = Menu.buildFromTemplate(menuItems)
          menu.popup()
        }
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
          gtnService,
        },
        __BUILD_INFO__,
      )
      logger.info('Initial environment info collection completed')
    } catch (error) {
      logger.error('Failed to collect initial environment info:', error)
    }
  })()

  // Check for updates on startup (async in background)
  checkForAppUpdates(true)

  // Check for engine updates on startup (async in background)
  checkForEngineUpdates(true)

  // Check if we should show release notes after an update (async in background)
  checkForReleaseNotes()

  // Set up periodic update checks (every 6 hours)
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000
  setInterval(() => {
    logger.info('UpdateService: Running periodic update check...')
    checkForAppUpdates(false)
    checkForEngineUpdates(false)
  }, SIX_HOURS_MS)
  logger.info('UpdateService: Periodic update check scheduled (every 6 hours)')
})

// Store pending update info so renderer can retrieve it
let pendingUpdateInfo: { info: any; isReadyToInstall: boolean } | null = null

// Store pending engine update info so renderer can retrieve it
let pendingEngineUpdateInfo: {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
} | null = null

// Store pending release notes info so renderer can retrieve it after update
let pendingReleaseNotes: {
  version: string
  content: string
} | null = null

// Track if engine update is in progress (prevents app restart during engine update)
let isEngineUpdateInProgress = false

/** Helper to broadcast IPC event to all renderer windows */
function broadcastToRenderer(channel: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, ...args)
  })
}

/**
 * Performs engine update: stops engine, upgrades, restarts, and notifies renderer.
 * Used by both auto-update on startup and manual update from banner.
 */
async function performEngineUpdate(): Promise<{ success: boolean; error?: string }> {
  isEngineUpdateInProgress = true
  broadcastToRenderer('engine-update:started')

  try {
    await engineService.stopEngine()

    if (FakeEngineUpdateManager.isEnabled()) {
      const fakeManager = new FakeEngineUpdateManager()
      await fakeManager.performUpdate()
    } else {
      await gtnService.upgradeGtn()
    }

    await engineService.startEngine()

    // Refresh environment info to get updated version
    try {
      const envInfo = await environmentInfoService.collectEnvironmentInfo(
        {
          pythonService,
          uvService,
          gtnService,
        },
        __BUILD_INFO__,
      )
      logger.info('EngineUpdateService: Environment info refreshed after update')
      broadcastToRenderer('environment-info:updated', envInfo)
    } catch (envError) {
      logger.error('EngineUpdateService: Failed to refresh environment info:', envError)
    }

    logger.info('EngineUpdateService: Update complete')
    broadcastToRenderer('engine-update:complete')

    return { success: true }
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    logger.error('EngineUpdateService: Update failed:', error)
    broadcastToRenderer('engine-update:failed', errorMessage)

    return { success: false, error: errorMessage }
  } finally {
    isEngineUpdateInProgress = false
  }
}

async function checkForAppUpdates(isStartup: boolean = true) {
  if (isStartup) {
    // Short delay to ensure window is minimally ready
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (!updateService.isUpdateSupported()) {
    logger.info(`UpdateService: Skipping update check (not supported)`)
    return
  }

  // In dev mode with fake updates on startup, clear dismissed version so banner shows each time
  if (isStartup && !isPackaged() && process.env.FAKE_UPDATE_AVAILABLE === 'true') {
    logger.info('UpdateService: Clearing dismissed version for fake update testing')
    settingsService.setDismissedUpdateVersion(null)
  }

  logger.info(`UpdateService: Checking for updates (${isStartup ? 'startup' : 'periodic'})...`)

  try {
    const updateManager = updateService.getUpdateManager()
    const updateInfo = await updateManager.checkForUpdatesAsync()

    if (!updateInfo) {
      logger.info('UpdateService: No updates available at startup')
      return
    }

    logger.info(
      `UpdateService: Update available at startup: ${updateInfo.TargetFullRelease?.Version}`,
    )

    // Check for env variable override, otherwise use settings
    // FAKE_UPDATE_BEHAVIOR can be: 'auto-update', 'prompt', or 'silence'
    // Legacy FAKE_ENABLE_AUTO_DOWNLOAD_UPDATE: 'true' = auto-update, 'false' = prompt
    const envBehavior = process.env.FAKE_UPDATE_BEHAVIOR
    const legacyEnvOverride = process.env.FAKE_ENABLE_AUTO_DOWNLOAD_UPDATE
    let updateBehavior: UpdateBehavior
    if (envBehavior !== undefined) {
      // New env var: directly set behavior
      const validBehaviors: UpdateBehavior[] = ['auto-update', 'prompt', 'silence']
      updateBehavior = validBehaviors.includes(envBehavior as UpdateBehavior)
        ? (envBehavior as UpdateBehavior)
        : 'prompt'
      logger.info(
        `UpdateService: Update behavior override from FAKE_UPDATE_BEHAVIOR: ${updateBehavior}`,
      )
    } else if (legacyEnvOverride !== undefined) {
      // Legacy env var: map boolean to behavior
      updateBehavior = legacyEnvOverride.toLowerCase() === 'true' ? 'auto-update' : 'prompt'
      logger.info(
        `UpdateService: Update behavior override from FAKE_ENABLE_AUTO_DOWNLOAD_UPDATE: ${updateBehavior}`,
      )
    } else {
      updateBehavior = settingsService.getUpdateBehavior()
    }

    if (updateBehavior === 'auto-update') {
      // Auto-update enabled: download automatically, then show "Restart Now" banner
      logger.info('UpdateService: Auto-downloading update...')

      // Emit download started event with update info
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('update:download-started', updateInfo)
      })

      try {
        await updateManager.downloadUpdateAsync(updateInfo, (progress) => {
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send('update:download-progress', progress)
          })
        })

        // Emit download complete event
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('update:download-complete')
        })

        logger.info('UpdateService: Update downloaded, showing banner for user to restart')

        // Store pending update and notify renderer to show "Restart Now" banner
        pendingUpdateInfo = { info: updateInfo, isReadyToInstall: true }
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('update:ready-to-install', updateInfo)
        })
      } catch (downloadError) {
        logger.error('UpdateService: Failed to download update:', downloadError)

        // Emit download failed event so renderer can show error banner
        const errorMessage =
          downloadError instanceof Error ? downloadError.message : 'Download failed'
        pendingUpdateInfo = { info: updateInfo, isReadyToInstall: false }
        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('update:download-failed', updateInfo, errorMessage)
        })
      }
      return
    } else if (updateBehavior === 'prompt') {
      // Prompt for update: notify that update is available
      logger.info('UpdateService: Notifying renderer of available update (prompt mode)')
      pendingUpdateInfo = { info: updateInfo, isReadyToInstall: false }
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('update:available', updateInfo)
      })
    } else {
      // Silence updates: do not notify
      logger.info('UpdateService: Updates silenced, not notifying user')
    }
  } catch (error) {
    logger.error('UpdateService: Failed to check for updates:', error)
  }
}

/**
 * Checks if the app was updated and should show release notes.
 * Compares current version with last seen version from settings.
 */
async function checkForReleaseNotes() {
  // Short delay to ensure window is ready
  await new Promise((resolve) => setTimeout(resolve, 2000))

  const currentVersion = updateService.getCurrentVersion()
  const lastSeenVersion = settingsService.getLastSeenVersion()

  logger.info(
    'ReleaseNotesCheck: currentVersion:',
    currentVersion,
    'lastSeenVersion:',
    lastSeenVersion,
  )

  // If same version, nothing to show
  if (currentVersion === lastSeenVersion) {
    logger.info('ReleaseNotesCheck: Same version, skipping')
    return
  }

  // First launch (lastSeenVersion is null) - set version but don't show modal
  if (lastSeenVersion === null) {
    logger.info('ReleaseNotesCheck: First launch, setting lastSeenVersion without showing modal')
    settingsService.setLastSeenVersion(currentVersion)
    return
  }

  // Version changed - check if we have release notes to show
  const releaseNotes = __RELEASE_NOTES__
  if (!releaseNotes.content || releaseNotes.content.trim() === '') {
    logger.info('ReleaseNotesCheck: No release notes content, updating lastSeenVersion')
    settingsService.setLastSeenVersion(currentVersion)
    return
  }

  // Check if user has disabled release notes notifications
  if (!settingsService.getShowReleaseNotes()) {
    logger.info('ReleaseNotesCheck: User disabled release notes, updating lastSeenVersion')
    settingsService.setLastSeenVersion(currentVersion)
    return
  }

  // Store pending release notes and notify renderer
  logger.info('ReleaseNotesCheck: Version changed, showing release notes modal')
  pendingReleaseNotes = {
    version: currentVersion,
    content: releaseNotes.content,
  }

  broadcastToRenderer('release-notes:available', pendingReleaseNotes)
}

async function checkForEngineUpdates(isStartup: boolean = true) {
  try {
    // Wait for GTN service to be ready
    await gtnService.waitForReady()

    // In dev mode with fake engine updates on startup, clear dismissed version so banner shows each time
    if (isStartup && FakeEngineUpdateManager.isEnabled()) {
      logger.info('EngineUpdateService: Clearing dismissed version for fake engine update testing')
      settingsService.setDismissedEngineUpdateVersion(null)
    }

    // Check engine update behavior setting (separate from app update behavior)
    // Allow env var override for dev testing
    const behaviorOverride = FakeEngineUpdateManager.getBehaviorOverride()
    const engineUpdateBehavior = behaviorOverride ?? settingsService.getEngineUpdateBehavior()
    if (engineUpdateBehavior === 'silence') {
      logger.info('EngineUpdateService: Updates silenced, skipping engine update check')
      return
    }

    logger.info(
      `EngineUpdateService: Checking for engine updates (${isStartup ? 'startup' : 'periodic'})...`,
    )

    const result = await gtnService.checkForEngineUpdate()

    if (!result.updateAvailable) {
      logger.info('EngineUpdateService: No engine updates available')
      return
    }

    // Check if this version was dismissed (only for prompt mode)
    if (engineUpdateBehavior === 'prompt') {
      const dismissedVersion = settingsService.getDismissedEngineUpdateVersion()
      if (result.latestVersion === dismissedVersion) {
        logger.info(
          `EngineUpdateService: Engine update v${result.latestVersion} was previously dismissed`,
        )
        return
      }
    }

    logger.info(
      `EngineUpdateService: Engine update available: v${result.currentVersion} -> v${result.latestVersion}`,
    )

    // Store pending update info so banner can display version
    pendingEngineUpdateInfo = result

    // Notify renderer about available update (for both auto-update and prompt modes)
    // This ensures the banner has version info to display
    broadcastToRenderer('engine-update:available', result)

    // Handle auto-update behavior
    if (engineUpdateBehavior === 'auto-update') {
      logger.info('EngineUpdateService: Auto-updating engine...')
      const updateResult = await performEngineUpdate()
      if (updateResult.success) {
        pendingEngineUpdateInfo = null
      }
    }
  } catch (error) {
    logger.error('EngineUpdateService: Failed to check for engine updates:', error)
  }
}

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
        detail: 'Updates are not available in development mode.',
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
          detail: `Version ${updateService.getCurrentVersion()}`,
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
        detail: 'Would you like to download and install it now?',
      },
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
        detail: `Failed to check for updates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }
}

const downloadAndInstallUpdateWithDialog = async (
  updateInfo: any,
  browserWindow?: BrowserWindow,
) => {
  const updateManager = updateService.getUpdateManager()

  logger.info('UpdateService: Downloading update...')

  // Emit download start event with update info
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('update:download-started', updateInfo)
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
      detail: 'The application will restart to apply the update.',
    },
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
    },
  }

  const aboutMenuItem = {
    label: `About ${app.getName()}`,
    click: async () => await showAboutDialog(),
  }

  const appSettingsItem = {
    label: 'App Settings',
    click: () => {
      const focusedWindow = BrowserWindow.getFocusedWindow()
      if (focusedWindow) {
        focusedWindow.webContents.send('navigate-to-settings')
      }
    },
  }

  // Build template based on platform
  const template: MenuItemConstructorOptions[] = []

  // macOS: Include app menu with About, Check for Updates, Hide, and Quit
  if (process.platform === 'darwin') {
    template.push({
      label: app.getName(),
      submenu: [
        aboutMenuItem,
        { type: 'separator' },
        checkForUpdatesItem,
        { type: 'separator' },
        appSettingsItem,
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  // Windows/Linux: Add File menu with App Settings
  if (process.platform !== 'darwin') {
    template.push({
      label: 'File',
      submenu: [appSettingsItem],
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
      { role: 'selectAll' },
    ],
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
        },
      },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  })

  // Window menu (all platforms)
  template.push({
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' },
      ...(process.platform === 'darwin'
        ? [{ type: 'separator' as const }, { role: 'front' as const }]
        : []),
    ],
  })

  // Windows/Linux: Add Help menu with About and Check for Updates
  if (process.platform !== 'darwin') {
    template.push({
      label: 'Help',
      submenu: [aboutMenuItem, { type: 'separator' }, checkForUpdatesItem],
    })
  }

  // Developer menu (dev mode only)
  if (!isPackaged()) {
    template.push({
      label: 'Developer',
      submenu: [
        {
          label: 'Reset Onboarding',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            onboardingService.resetOnboarding()
            const focusedWindow = BrowserWindow.getFocusedWindow()
            if (focusedWindow) {
              focusedWindow.reload()
            }
          },
        },
      ],
    })
  }

  const menu = Menu.buildFromTemplate(template)
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
    '',
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
    '',
  )

  // UV information
  const uvVersion = envInfo?.uv?.version || (await uvService.getUvVersion()) || 'Not installed'
  const uvToolDir = envInfo?.uv?.toolDir || 'Unknown'
  const uvPythonInstallDir = envInfo?.uv?.pythonInstallDir || 'Unknown'

  detailText.push(
    `UV: ${uvVersion}`,
    `UV Tool Directory: ${uvToolDir}`,
    `UV Python Install Directory: ${uvPythonInstallDir}`,
    '',
  )

  // Griptape Nodes information
  const gtnVersion = envInfo?.griptapeNodes?.version || 'Not installed'
  const gtnPath = envInfo?.griptapeNodes?.path || 'Unknown'
  const gtnInstalled = envInfo?.griptapeNodes?.installed ? 'Yes' : 'No'

  detailText.push(
    `Griptape Nodes: ${gtnVersion}`,
    `GTN Path: ${gtnPath}`,
    `GTN Installed: ${gtnInstalled}`,
    '',
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
    buttons: ['OK'],
  })
}

const setupKeyboardShortcuts = (mainWindow: BrowserWindow) => {
  // Set up right-click context menu
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems = buildEditContextMenu(params, mainWindow.webContents)
    const menu = Menu.buildFromTemplate(menuItems)
    menu.popup({ window: mainWindow })
  })
}

let ipcInitialized = false

/**
 * Orchestrates a full stack reinstall of UV, Python, and GTN
 * Preserves user settings during the process
 */
async function reinstallFullStack(): Promise<void> {
  logger.info('Starting full stack reinstall')

  // Stop engine first
  logger.info('Stopping engine...')
  engineService.addLog('stdout', 'Stopping engine for reinstall...')
  await engineService.stopEngine()

  // Set engine to initializing state
  engineService.setInitializing()

  try {
    // Reinstall UV
    logger.info('Reinstalling UV...')
    engineService.addLog('stdout', 'Reinstalling UV package manager...')
    await uvService.reinstall()
    engineService.addLog('stdout', 'UV reinstalled successfully')

    // Reinstall Python
    logger.info('Reinstalling Python...')
    engineService.addLog('stdout', 'Reinstalling Python...')
    await pythonService.reinstall()
    engineService.addLog('stdout', 'Python reinstalled successfully')

    // Reinstall GTN (includes initialization with user settings)
    logger.info('Reinstalling GTN...')
    engineService.addLog('stdout', 'Reinstalling Griptape Nodes engine...')
    await gtnService.reinstall()
    engineService.addLog('stdout', 'Griptape Nodes engine reinstalled successfully')

    engineService.addLog('stdout', 'Full stack reinstall completed successfully')
    logger.info('Full stack reinstall completed successfully')

    // Start the engine automatically
    logger.info('Starting engine...')
    engineService.addLog('stdout', 'Starting engine...')
    await engineService.startEngine()
    engineService.addLog('stdout', 'Engine started successfully')
  } catch (error) {
    logger.error('Full stack reinstall failed:', error)
    engineService.addLog('stderr', `Reinstall failed: ${getErrorMessage(error)}`)
    engineService.setError()
    throw error
  }
}

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

    // Emit download start event with update info
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:download-started', updateInfo)
    })

    await updateManager.downloadUpdateAsync(updateInfo, (progress) => {
      // Emit progress to all windows
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('update:download-progress', progress)
      })
    })

    // Emit download complete event
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:download-complete')
    })

    // Store pending update and notify renderer that update is ready to install
    pendingUpdateInfo = { info: updateInfo, isReadyToInstall: true }
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update:ready-to-install', updateInfo)
    })

    return true
  })

  ipcMain.handle('velopack:apply-update', async (_, updateInfo) => {
    // Wait for engine update to complete before restarting
    if (isEngineUpdateInProgress) {
      logger.info('UpdateService: Waiting for engine update to complete before restarting...')
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isEngineUpdateInProgress) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 500)
      })
      logger.info('UpdateService: Engine update complete, proceeding with restart')
    }

    const updateManager = updateService.getUpdateManager()
    updateManager.waitExitThenApplyUpdate(updateInfo)

    // In dev mode (fake updates), relaunch the app to simulate restart
    if (!updateService.isUpdateSupported()) {
      logger.info('FakeUpdateManager: Simulating app restart...')
      app.relaunch()
    }

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
          data: envInfo,
        }
      } else {
        return {
          success: false,
          error: ENV_INFO_NOT_COLLECTED,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
          gtnService,
        },
        __BUILD_INFO__,
      )

      return {
        success: true,
        data: envInfo,
      }
    } catch (error) {
      logger.error('Failed to collect environment info:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
          gtnService,
        },
        __BUILD_INFO__,
      )

      return {
        success: true,
        data: envInfo,
      }
    } catch (error) {
      logger.error('Failed to refresh environment info:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
          'auth:check - Token is expired or missing expiration time, returning credentials for refresh attempt',
        )
        return {
          isAuthenticated: true,
          ...credentials,
        }
      }
      return {
        isAuthenticated: true,
        ...credentials,
      }
    }
    return {
      isAuthenticated: false,
    }
  })

  // Synchronous auth check for webview preload
  ipcMain.on('auth:check-sync', (event) => {
    logger.info('[auth:check-sync] Webview preload requesting auth data')

    const credentials = authService.getStoredCredentials()

    logger.info('[auth:check-sync] Credentials status:', {
      hasCredentials: !!credentials,
      hasTokens: !!credentials?.tokens,
      hasUser: !!credentials?.user,
      hasApiKey: !!credentials?.apiKey,
      expiresAt: credentials?.expiresAt,
    })

    if (credentials && credentials.tokens) {
      // Always return tokens if they exist, even if expired
      // The webview/editor's Auth0 SDK can handle token refresh automatically
      // if a refresh_token is present
      const currentTime = Math.floor(Date.now() / 1000)
      const isExpired = !credentials.expiresAt || currentTime >= credentials.expiresAt

      if (isExpired) {
        logger.info(
          '[auth:check-sync] Token is expired but returning it anyway for webview refresh',
        )
      } else {
        logger.info(
          `[auth:check-sync] Token is valid, expires in ${credentials.expiresAt - currentTime} seconds`,
        )
      }

      logger.info('[auth:check-sync] ✅ Returning authenticated credentials to webview preload')
      event.returnValue = {
        isAuthenticated: true,
        ...credentials,
      }
    } else {
      logger.warn('[auth:check-sync] ❌ No credentials available, returning not authenticated')
      event.returnValue = {
        isAuthenticated: false,
      }
    }
  })

  // Handle postMessage authentication protocol from embedded editor webview
  // Note: This is a sync handler, but we need to handle async token refresh.
  // We use a hybrid approach: return current token if valid, or trigger async refresh
  // and return a "refreshing" status so the webview can retry.
  ipcMain.on('webview:auth-token-request', (event) => {
    logger.info('[Webview Auth] Editor requesting access token')
    try {
      const credentials = authService.getStoredCredentials()

      if (!credentials || !credentials.tokens || !credentials.tokens.access_token) {
        logger.warn('[Webview Auth] No access token available')
        event.returnValue = { token: null, error: 'Not authenticated' }
        return
      }

      // Check if token is expired or about to expire (within 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000)
      const fiveMinutes = 5 * 60
      const isExpired = !credentials.expiresAt || currentTime >= credentials.expiresAt
      const isAboutToExpire =
        credentials.expiresAt && credentials.expiresAt - currentTime < fiveMinutes

      if (isExpired || isAboutToExpire) {
        logger.info(
          `[Webview Auth] Token ${isExpired ? 'expired' : 'about to expire'}, attempting refresh...`,
        )

        // Trigger async refresh - the webview will be notified via auth:tokens-updated
        authService
          .attemptTokenRefresh()
          .then((result) => {
            if (result.success) {
              logger.info('[Webview Auth] Token refresh successful, broadcasting update')
              // Broadcast the updated tokens to all webviews
              const updatedCredentials = authService.getStoredCredentials()
              if (updatedCredentials?.tokens) {
                webContents.getAllWebContents().forEach((contents) => {
                  contents.send('auth:tokens-updated', {
                    tokens: updatedCredentials.tokens,
                    expiresAt: updatedCredentials.expiresAt,
                  })
                })
              }
            } else {
              logger.warn('[Webview Auth] Token refresh failed:', result.error)
            }
          })
          .catch((err) => {
            logger.error('[Webview Auth] Token refresh error:', err)
          })

        // If completely expired, tell webview to wait for refresh
        if (isExpired) {
          event.returnValue = { token: null, error: 'Token expired, refreshing...' }
          return
        }
        // If just about to expire, return current token while refresh happens in background
      }

      logger.info('[Webview Auth] Returning access token to editor')
      event.returnValue = { token: credentials.tokens.access_token }
    } catch (err) {
      logger.error('[Webview Auth] Error getting token:', err)
      event.returnValue = { token: null, error: 'Internal error' }
    }
  })

  ipcMain.on('webview:user-info-request', (event) => {
    logger.info('[Webview Auth] Editor requesting user info')
    try {
      const credentials = authService.getStoredCredentials()

      if (!credentials || !credentials.user) {
        logger.warn('[Webview Auth] No user info available')
        event.returnValue = { user: null, error: 'Not authenticated' }
        return
      }

      logger.info('[Webview Auth] Returning user info to editor:', {
        email: credentials.user.email,
      })
      event.returnValue = { user: credentials.user }
    } catch (err) {
      logger.error('[Webview Auth] Error getting user info:', err)
      event.returnValue = { user: null, error: 'Internal error' }
    }
  })

  ipcMain.on('webview:logout-request', (event) => {
    logger.info('[Webview Auth] Editor requesting logout')
    try {
      authService.clearCredentials()

      // Reset credential storage preference (consistent with auth:logout)
      onboardingService.setCredentialStorageEnabled(false)

      event.returnValue = { success: true }

      // Notify all windows that user logged out
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('auth:logout')
      })
      logger.info('[Webview Auth] Logout successful')
    } catch (err) {
      logger.error('[Webview Auth] Error during logout:', err)
      event.returnValue = { success: false, error: 'Logout failed' }
    }
  })

  // Handle Auth Login
  ipcMain.handle('auth:login', () => authService.login())

  // Handle Auth Cancel
  ipcMain.handle('auth:cancel', () => authService.cancelLogin())

  // Handle Auth Token Refresh
  // Uses centralized refresh with mutex to prevent concurrent refresh attempts
  ipcMain.handle('auth:refresh-token', async () => {
    logger.info('[auth:refresh-token] Renderer requesting token refresh via IPC')
    const result = await authService.attemptTokenRefresh()
    logger.info('[auth:refresh-token] Refresh result:', {
      success: result.success,
      error: result.error,
    })
    return result
  })

  // Handle notification that tokens were updated (for broadcasting to webviews)
  ipcMain.handle('auth:notify-tokens-updated', async () => {
    const credentials = authService.getStoredCredentials()
    if (credentials && credentials.tokens) {
      // Update GTN config with new API key if it exists
      if (credentials.apiKey) {
        try {
          await gtnService.updateApiKey(credentials.apiKey)
        } catch (error) {
          logger.error('Failed to update GTN API key:', error)
        }
      }

      // Broadcast to all webContents (including webviews) that tokens have been updated
      webContents.getAllWebContents().forEach((contents) => {
        contents.send('auth:tokens-updated', {
          tokens: credentials.tokens,
          expiresAt: credentials.expiresAt,
          apiKey: credentials.apiKey,
        })
      })
    }
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

  // Handle fullscreen requests from webview
  ipcMain.handle('window:set-fullscreen', (event, fullscreen: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.setFullScreen(fullscreen)
    }
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('engine:reinstall', async () => {
    try {
      await reinstallFullStack()
      return { success: true }
    } catch (error) {
      logger.error('Failed to reinstall engine:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Track the currently running command process for stdin
  let currentCommandProcess: ChildProcess | null = null

  ipcMain.handle('engine:run-command', async (_event, commandInput: string) => {
    try {
      const trimmed = commandInput.trim()

      // If there's a running process with stdin, send input to it
      if (
        currentCommandProcess &&
        currentCommandProcess.stdin &&
        !currentCommandProcess.stdin.destroyed
      ) {
        currentCommandProcess.stdin.write(commandInput + '\n')
        return { success: true }
      }

      // Otherwise, start a new command
      // Split into args, handling quotes
      const args = trimmed.split(/\s+/).filter((arg) => arg.length > 0)

      // Strip "gtn" prefix if provided
      if (args[0] === 'gtn') {
        args.shift()
      }

      // Guard: prevent starting second engine
      if (args.length === 0 || args[0] === 'engine') {
        const errorMsg = 'Cannot execute "gtn engine" - use the Engine controls instead'
        engineService.addLog('stdout', `$ gtn ${args.join(' ') || ''}`)
        engineService.addLog('stderr', errorMsg)
        return {
          success: false,
          error: errorMsg,
        }
      }

      // Log the command being executed
      engineService.addLog('stdout', `$ gtn ${args.join(' ')}`)

      // Execute the command
      const child = await gtnService.runGtn(args, {
        forward_logs: false, // We'll handle output manually
        wait: false,
      })

      // Track this as the current command process
      currentCommandProcess = child

      // Stream stdout line-by-line
      child.stdout?.on('data', (data: Buffer) => {
        const lines = data
          .toString()
          .split('\n')
          .filter((line) => line.trim())
        lines.forEach((line) => {
          engineService.addLog('stdout', line)
        })
      })

      // Stream stderr line-by-line
      child.stderr?.on('data', (data: Buffer) => {
        const lines = data
          .toString()
          .split('\n')
          .filter((line) => line.trim())
        lines.forEach((line) => {
          engineService.addLog('stderr', line)
        })
      })

      // Handle process completion
      child.on('close', (code) => {
        if (currentCommandProcess === child) {
          currentCommandProcess = null
        }
        if (code !== 0) {
          engineService.addLog('stderr', `Command exited with code ${code}`)
        }
      })

      return { success: true }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      engineService.addLog('stderr', `Failed to execute command: ${errorMessage}`)
      return { success: false, error: errorMessage }
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
      title: 'Select Workspace Directory',
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('gtn:refresh-config', () => gtnService.refreshConfig())

  ipcMain.handle('gtn:get-workflows', async () => {
    await gtnService.waitForReady()
    return gtnService.getWorkflows()
  })

  ipcMain.handle(
    'gtn:reconfigure-engine',
    async (
      event,
      config: {
        workspaceDirectory: string
        advancedLibrary: boolean
        cloudLibrary: boolean
      },
    ) => {
      logger.info('Reconfiguring engine with new workspace/library preferences')

      // Stop engine
      await engineService.stopEngine()

      // Update preferences in onboarding service
      onboardingService.setAdvancedLibraryEnabled(config.advancedLibrary)
      onboardingService.setCloudLibraryEnabled(config.cloudLibrary)
      gtnService.workspaceDirectory = config.workspaceDirectory

      // Re-initialize with new configuration
      const apiKey = await authService.waitForApiKey()
      await gtnService.initialize({
        apiKey,
        workspaceDirectory: config.workspaceDirectory,
        storageBackend: 'local',
        advancedLibrary: config.advancedLibrary,
        cloudLibrary: config.cloudLibrary,
      })

      // Restart engine
      await engineService.startEngine()

      logger.info('Engine reconfiguration complete')
    },
  )

  ipcMain.handle('gtn:upgrade', async () => {
    try {
      await gtnService.upgradeGtn()
      return { success: true }
    } catch (error) {
      logger.error('Failed to upgrade GTN:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('gtn:force-reinstall', async () => {
    try {
      // Stop the engine before reinstalling
      await engineService.stopEngine()

      // Force reinstall GTN
      await gtnService.forceReinstallGtn()

      // Restart the engine with the reinstalled version
      engineService.restartEngine()

      return { success: true }
    } catch (error) {
      logger.error('Failed to force reinstall GTN:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // Engine update handlers
  ipcMain.handle('gtn:check-for-engine-update', async () => {
    try {
      await gtnService.waitForReady()
      const result = await gtnService.checkForEngineUpdate()
      return { success: true, ...result }
    } catch (error) {
      logger.error('Failed to check for engine update:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('gtn:get-pending-engine-update', () => {
    return pendingEngineUpdateInfo
  })

  ipcMain.handle('gtn:perform-engine-update', async () => {
    const result = await performEngineUpdate()
    if (result.success) {
      pendingEngineUpdateInfo = null
    }
    return result
  })

  // Release notes handlers
  ipcMain.handle('release-notes:get-pending', () => {
    return pendingReleaseNotes
  })

  ipcMain.handle('release-notes:dismiss', () => {
    const currentVersion = updateService.getCurrentVersion()
    settingsService.setLastSeenVersion(currentVersion)
    pendingReleaseNotes = null
    return { success: true }
  })

  // Engine channel handlers
  ipcMain.handle('settings:get-engine-channel', () => {
    return settingsService.getEngineChannel()
  })

  ipcMain.handle('settings:set-engine-channel', async (event, channel: 'stable' | 'nightly') => {
    try {
      // Save the preference and mark channel switch as in progress
      settingsService.setEngineChannel(channel)
      settingsService.setChannelSwitchInProgress(true)

      // Stop the engine before switching
      await engineService.stopEngine()

      // Switch the channel (uninstall + reinstall)
      await gtnService.switchChannel(channel)

      // Restart the engine with the new version
      await engineService.restartEngine()

      // Refresh environment info to get updated version
      try {
        const envInfo = await environmentInfoService.collectEnvironmentInfo(
          {
            pythonService,
            uvService,
            gtnService,
          },
          __BUILD_INFO__,
        )
        logger.info('Channel switch: Environment info refreshed')
        broadcastToRenderer('environment-info:updated', envInfo)
      } catch (envError) {
        logger.error('Channel switch: Failed to refresh environment info:', envError)
      }

      // Clear the in-progress flag after restart is complete
      settingsService.setChannelSwitchInProgress(false)

      return { success: true }
    } catch (error) {
      logger.error('Failed to switch engine channel:', error)
      // Clear the in-progress flag on error
      settingsService.setChannelSwitchInProgress(false)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('settings:is-channel-switch-in-progress', () => {
    return settingsService.isChannelSwitchInProgress()
  })

  ipcMain.handle('settings:get-available-engine-channels', () => {
    return ['stable', 'nightly']
  })

  // Editor channel handlers
  ipcMain.handle('settings:get-editor-channel', () => {
    return settingsService.getEditorChannel()
  })

  ipcMain.handle('settings:set-editor-channel', (event, channel: 'stable' | 'nightly') => {
    settingsService.setEditorChannel(channel)
    return { success: true }
  })

  // Local engine path handlers (for development)
  ipcMain.handle('settings:get-local-engine-path', () => {
    return settingsService.getLocalEnginePath()
  })

  ipcMain.handle('settings:set-local-engine-path', async (event, path: string | null) => {
    try {
      settingsService.setLocalEnginePath(path)
      return { success: true }
    } catch (error) {
      logger.error('Failed to set local engine path:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('settings:select-local-engine-path', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (!focusedWindow) {
      return { success: false, error: 'No focused window' }
    }

    const result = await dialog.showOpenDialog(focusedWindow, {
      properties: ['openDirectory'],
      title: 'Select Local Griptape Nodes Repository',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    const selectedPath = result.filePaths[0]
    settingsService.setLocalEnginePath(selectedPath)
    return { success: true, path: selectedPath }
  })

  ipcMain.handle('settings:get-confirm-on-close', () => {
    return settingsService.getConfirmOnClose()
  })

  ipcMain.handle('settings:set-confirm-on-close', (_event, confirm: boolean) => {
    settingsService.setConfirmOnClose(confirm)
    return { success: true }
  })

  ipcMain.handle('settings:get-show-release-notes', () => {
    return settingsService.getShowReleaseNotes()
  })

  ipcMain.handle('settings:set-show-release-notes', (_event, show: boolean) => {
    settingsService.setShowReleaseNotes(show)
    return { success: true }
  })

  ipcMain.handle('settings:get-log-retention', () => {
    return settingsService.getLogRetention()
  })

  ipcMain.handle(
    'settings:set-log-retention',
    async (
      _event,
      retention: { value: number; unit: 'days' | 'months' | 'years' | 'indefinite' },
    ) => {
      settingsService.setLogRetention(retention)
      // Run cleanup with new retention settings
      await engineLogFileService.cleanupOldLogs()
      return { success: true }
    },
  )

  // Update service handlers
  ipcMain.handle('update:check', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    await checkForUpdatesWithDialog(focusedWindow || undefined)
    return { success: true }
  })

  ipcMain.handle('update:is-supported', () => {
    return updateService.isUpdateSupported()
  })

  ipcMain.handle('update:get-pending', () => {
    return pendingUpdateInfo
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

  ipcMain.handle('onboarding:enable-credential-storage', async () => {
    try {
      // Test encryption first to ensure keychain access is granted
      // This triggers the macOS keychain prompt if needed
      const { safeStorage } = await import('electron')

      if (!safeStorage.isEncryptionAvailable()) {
        return {
          success: false,
          error: 'Encryption not available on this platform',
        }
      }

      // Try to encrypt a test string - this triggers the keychain prompt on macOS
      const testString = 'test-credential-storage'
      const encrypted = safeStorage.encryptString(testString)
      const decrypted = safeStorage.decryptString(encrypted)

      if (decrypted !== testString) {
        return {
          success: false,
          error: 'Encryption verification failed',
        }
      }

      // Encryption works, now enable persistence
      authService.enablePersistence()
      onboardingService.setCredentialStorageEnabled(true)
      onboardingService.setKeychainAccessGranted(true)
      return { success: true }
    } catch (error) {
      logger.error('Failed to enable credential storage:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Keychain access denied',
      }
    }
  })

  ipcMain.handle('auth:load-from-persistent-store', () => {
    return authService.loadFromPersistentStore()
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

  ipcMain.handle('onboarding:is-advanced-library-enabled', () => {
    return onboardingService.isAdvancedLibraryEnabled()
  })

  ipcMain.handle('onboarding:set-advanced-library-enabled', (event, enabled: boolean) => {
    onboardingService.setAdvancedLibraryEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('onboarding:is-cloud-library-enabled', () => {
    return onboardingService.isCloudLibraryEnabled()
  })

  ipcMain.handle('onboarding:set-cloud-library-enabled', (event, enabled: boolean) => {
    onboardingService.setCloudLibraryEnabled(enabled)
    return { success: true }
  })

  ipcMain.handle('onboarding:is-tutorial-completed', () => {
    return onboardingService.isTutorialCompleted()
  })

  ipcMain.handle('onboarding:set-tutorial-completed', (_event, completed: boolean) => {
    onboardingService.setTutorialCompleted(completed)
    return { success: true }
  })

  ipcMain.handle('onboarding:get-tutorial-last-step', () => {
    return onboardingService.getTutorialLastStep()
  })

  ipcMain.handle('onboarding:set-tutorial-last-step', (_event, step: number) => {
    onboardingService.setTutorialLastStep(step)
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
          error: 'Encryption not available on this platform',
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
          error: 'Encryption test failed: decrypted value does not match',
        }
      }

      return { success: true }
    } catch (error) {
      logger.error('Encryption test failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown encryption error',
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

  // Migration handlers
  ipcMain.handle('migration:check-default-locations', async () => {
    return migrationService.checkDefaultLocations()
  })

  ipcMain.handle('migration:scan-home-directory', async () => {
    return migrationService.scanHomeDirectory()
  })

  ipcMain.handle('migration:validate-config', async (_event, filePath: string) => {
    return migrationService.validateConfigFile(filePath)
  })

  ipcMain.handle('migration:import-config', async (_event, filePath: string) => {
    return migrationService.importConfig(filePath)
  })

  ipcMain.handle('migration:copy-workspace', async (_event, sourceDir: string, destDir: string) => {
    return migrationService.copyWorkspace(sourceDir, destDir)
  })

  ipcMain.handle('migration:select-config-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Select Griptape Nodes Config File',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
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

  ipcMain.handle('settings:get-update-behavior', () => {
    return settingsService.getUpdateBehavior()
  })

  ipcMain.handle('settings:set-update-behavior', (_, behavior: UpdateBehavior) => {
    settingsService.setUpdateBehavior(behavior)
    return { success: true }
  })

  ipcMain.handle('settings:get-dismissed-update-version', () => {
    return settingsService.getDismissedUpdateVersion()
  })

  ipcMain.handle('settings:set-dismissed-update-version', (_, version: string | null) => {
    settingsService.setDismissedUpdateVersion(version)
    return { success: true }
  })

  ipcMain.handle('settings:get-dismissed-engine-update-version', () => {
    return settingsService.getDismissedEngineUpdateVersion()
  })

  ipcMain.handle('settings:set-dismissed-engine-update-version', (_, version: string | null) => {
    settingsService.setDismissedEngineUpdateVersion(version)
    return { success: true }
  })

  ipcMain.handle('settings:get-engine-update-behavior', () => {
    return settingsService.getEngineUpdateBehavior()
  })

  ipcMain.handle('settings:set-engine-update-behavior', (_, behavior: UpdateBehavior) => {
    settingsService.setEngineUpdateBehavior(behavior)
    return { success: true }
  })

  // Engine log file handlers
  ipcMain.handle('settings:get-engine-log-file-enabled', () => {
    return engineLogFileService.isLoggingEnabled()
  })

  ipcMain.handle('settings:set-engine-log-file-enabled', async (_, enabled: boolean) => {
    try {
      if (enabled) {
        await engineLogFileService.enable()
      } else {
        await engineLogFileService.disable()
      }
      return { success: true }
    } catch (error) {
      logger.error('Failed to set engine log file enabled:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle(
    'engine:export-logs',
    async (
      _,
      options?: {
        type: 'session' | 'days' | 'range' | 'since'
        days?: number
        startTime?: string
        endTime?: string
        sinceTime?: string
      },
    ) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        return { success: false, error: 'No window available' }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const exportType = options?.type || 'session'
      const days = options?.days || 1

      let defaultFilename: string
      switch (exportType) {
        case 'session':
          defaultFilename = `engine-logs-session-${timestamp}.txt`
          break
        case 'days':
          defaultFilename = `engine-logs-${days}days-${timestamp}.txt`
          break
        case 'range':
          defaultFilename = `engine-logs-range-${timestamp}.txt`
          break
        case 'since':
          defaultFilename = `engine-logs-since-${timestamp}.txt`
          break
        default:
          defaultFilename = `engine-logs-${timestamp}.txt`
      }

      const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultFilename,
        filters: [
          { name: 'Log Files', extensions: ['txt', 'log'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      try {
        switch (exportType) {
          case 'session':
            await engineLogFileService.exportSessionLogs(filePath)
            break
          case 'days':
            await engineLogFileService.exportLogsForDays(filePath, days)
            break
          case 'range':
            if (!options?.startTime || !options?.endTime) {
              return { success: false, error: 'Start and end time are required for range export' }
            }
            await engineLogFileService.exportLogsForRange(
              filePath,
              options.startTime,
              options.endTime,
            )
            break
          case 'since':
            if (!options?.sinceTime) {
              return { success: false, error: 'Since time is required for since export' }
            }
            await engineLogFileService.exportLogsSince(filePath, options.sinceTime)
            break
        }
        return { success: true, path: filePath }
      } catch (error) {
        logger.error('Failed to export logs:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
  )

  ipcMain.handle('engine:get-log-date-range', async () => {
    try {
      return await engineLogFileService.getLogDateRange()
    } catch (error) {
      logger.error('Failed to get log date range:', error)
      return null
    }
  })

  ipcMain.handle('engine:get-log-file-path', () => {
    return engineLogFileService.getLogDir()
  })

  // System monitor handlers
  ipcMain.handle('system-monitor:get-metrics', async () => {
    try {
      const metrics = await systemMonitorService.getMetrics()
      return { success: true, metrics }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

  // Menu action handlers (for custom Windows title bar)
  ipcMain.handle('menu:about', async () => {
    await showAboutDialog()
  })

  ipcMain.handle('menu:check-for-updates', async () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    await checkForUpdatesWithDialog(focusedWindow || undefined)
  })

  ipcMain.handle('menu:app-settings', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.webContents.send('navigate-to-settings')
    }
  })

  ipcMain.handle('menu:reload', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      if (currentPage === 'editor') {
        focusedWindow.webContents.send('editor:do-reload-webview')
      } else {
        focusedWindow.reload()
      }
    }
  })

  ipcMain.handle('menu:force-reload', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.webContents.reloadIgnoringCache()
    }
  })

  ipcMain.handle('menu:toggle-devtools', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.webContents.toggleDevTools()
    }
  })

  ipcMain.handle('menu:reset-zoom', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.webContents.setZoomLevel(0)
    }
  })

  ipcMain.handle('menu:zoom-in', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      const currentZoom = focusedWindow.webContents.getZoomLevel()
      focusedWindow.webContents.setZoomLevel(currentZoom + 0.5)
    }
  })

  ipcMain.handle('menu:zoom-out', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      const currentZoom = focusedWindow.webContents.getZoomLevel()
      focusedWindow.webContents.setZoomLevel(currentZoom - 0.5)
    }
  })

  ipcMain.handle('menu:toggle-fullscreen', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
    }
  })

  ipcMain.handle('menu:minimize', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.minimize()
    }
  })

  ipcMain.handle('menu:maximize', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      if (focusedWindow.isMaximized()) {
        focusedWindow.unmaximize()
      } else {
        focusedWindow.maximize()
      }
    }
  })

  ipcMain.handle('menu:is-maximized', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    return focusedWindow ? focusedWindow.isMaximized() : false
  })

  ipcMain.handle('menu:close', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      focusedWindow.close()
    }
  })

  // Return getter function for current page
  return () => currentPage
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
