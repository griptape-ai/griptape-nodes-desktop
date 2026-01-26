import { Moon, Sun, Monitor, RefreshCw, ChevronDown, FolderOpen, X } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useEngine } from '../contexts/EngineContext'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from '../utils/utils'
import { ENV_INFO_NOT_COLLECTED } from '@/common/config/constants'
import type { UpdateBehavior, IpcEvent, EnvironmentInfo } from '@/types/global'

const UpdateBehaviorDescription: React.FC = () => (
  <p className="text-xs text-muted-foreground mt-1">
    Auto-Update: Automatically download and install updates on startup.
    <br />
    Prompt: Show a notification banner when updates are available.
    <br />
    Silence: Do not check for or notify about updates.
  </p>
)

const ChannelDescription: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <p className="text-xs text-muted-foreground mt-1">
    Stable: Official releases with stable features.
    <br />
    Nightly: Latest development build (may be unstable).
    {children}
  </p>
)

const Settings: React.FC = () => {
  const { apiKey } = useAuth()
  const {
    status,
    isUpgradePending,
    setIsUpgradePending,
    operationMessage,
    setOperationMessage,
    reinstallEngine
  } = useEngine()
  const { theme, setTheme } = useTheme()
  const [environmentInfo, setEnvironmentInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceDir, setWorkspaceDir] = useState<string>('')
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [currentChannel, setCurrentChannel] = useState<string>('')
  const [availableChannels, setAvailableChannels] = useState<string[]>([])
  const [channelDisplayNames, setChannelDisplayNames] = useState<Map<string, string>>(new Map())
  const [updatesSupported, setUpdatesSupported] = useState<boolean>(false)
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  const [versionError, setVersionError] = useState<boolean>(false)
  const [channelError, setChannelError] = useState<boolean>(false)
  const [channelsError, setChannelsError] = useState<boolean>(false)
  const [updateBehavior, setUpdateBehavior] = useState<UpdateBehavior>('prompt')
  const [engineUpdateBehavior, setEngineUpdateBehavior] = useState<UpdateBehavior>('prompt')
  const [upgradingEngine, setUpgradingEngine] = useState(false)
  const [showSystemMonitor, setShowSystemMonitor] = useState(false)
  const [confirmOnClose, setConfirmOnClose] = useState(true)
  const [showReleaseNotes, setShowReleaseNotes] = useState(true)
  const [engineLogFileEnabled, setEngineLogFileEnabled] = useState(false)
  const [engineChannel, setEngineChannel] = useState<'stable' | 'nightly'>('stable')
  const [switchingChannel, setSwitchingChannel] = useState(false)
  const [showReinstallDialog, setShowReinstallDialog] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [editorChannel, setEditorChannel] = useState<'stable' | 'nightly' | 'local'>('stable')
  const [showLocalOption, setShowLocalOption] = useState<boolean>(false)
  const [localEnginePath, setLocalEnginePath] = useState<string | null>(null)
  const [loadingLocalEnginePath, setLoadingLocalEnginePath] = useState(true)

  // Library settings state
  const [advancedLibrary, setAdvancedLibrary] = useState<boolean>(false)
  const [cloudLibrary, setCloudLibrary] = useState<boolean>(false)
  const [loadingLibrarySettings, setLoadingLibrarySettings] = useState(true)

  // Pending changes tracking
  const [pendingWorkspaceDir, setPendingWorkspaceDir] = useState<string>('')
  const [pendingAdvancedLibrary, setPendingAdvancedLibrary] = useState<boolean>(false)
  const [pendingCloudLibrary, setPendingCloudLibrary] = useState<boolean>(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Apply state
  const [isApplyingChanges, setIsApplyingChanges] = useState(false)

  // Toast notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    text: string
  } | null>(null)

  // Auto-clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleRefreshEnvironmentInfo = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const result = await window.pythonAPI.refreshEnvironmentInfo()

      if (result.success && result.data) {
        setEnvironmentInfo(result.data)
      } else {
        setError(result.error || 'Failed to refresh environment information')
      }
    } catch (err) {
      console.error('Failed to refresh environment info:', err)
      setError('Failed to refresh environment information')
    } finally {
      setRefreshing(false)
    }
  }, [])

  const loadEnvironmentInfo = useCallback(async () => {
    try {
      setError(null)
      const result = await window.pythonAPI.getEnvironmentInfo()

      if (result.success && result.data) {
        setEnvironmentInfo(result.data)
      } else if (result.error === ENV_INFO_NOT_COLLECTED) {
        // Automatically trigger collection if no data exists
        handleRefreshEnvironmentInfo()
      } else {
        setError(result.error || 'Failed to load environment information')
      }
    } catch (err) {
      console.error('Failed to load environment info:', err)
      setError('Failed to load environment information')
    } finally {
      setLoading(false)
    }
  }, [handleRefreshEnvironmentInfo])

  useEffect(() => {
    loadEnvironmentInfo()
    loadWorkspaceDirectory()
    loadLibrarySettings()
    loadUpdateInfo()
    loadSystemMonitorSetting()
    loadConfirmOnCloseSetting()
    loadShowReleaseNotesSetting()
    loadEngineLogFileSetting()
    loadEngineChannel()
    loadEditorChannel()
    loadUpdateBehaviorSetting()
    loadEngineUpdateBehaviorSetting()
    checkDevMode()
    loadLocalEnginePath()
    window.griptapeAPI.refreshConfig()

    const handleWorkspaceChanged = (_event: IpcEvent, directory: string) => {
      setWorkspaceDir(directory)
      setLoadingWorkspace(false)
    }

    // Handle environment info updates from main process (e.g., after engine update via banner)
    const handleEnvironmentInfoUpdated = (_event: IpcEvent, info: EnvironmentInfo) => {
      if (info) {
        setEnvironmentInfo(info)
      }
    }

    // Helper to scroll to and highlight a section
    const scrollToAndHighlight = (elementId: string) => {
      const element = document.getElementById(elementId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
        }, 2000)
      }
    }

    const handleScrollToUpdates = () => scrollToAndHighlight('desktop-app-updates')
    const handleScrollToEngineUpdates = () => scrollToAndHighlight('engine-updates')
    const handleScrollToLogging = () => scrollToAndHighlight('logging-diagnostics')
    const handleScrollToWorkspace = () => scrollToAndHighlight('workspace-settings')

    window.griptapeAPI.onWorkspaceChanged(handleWorkspaceChanged)
    window.pythonAPI.onEnvironmentInfoUpdated(handleEnvironmentInfoUpdated)
    window.addEventListener('scroll-to-updates', handleScrollToUpdates)
    window.addEventListener('scroll-to-engine-updates', handleScrollToEngineUpdates)
    window.addEventListener('scroll-to-logging', handleScrollToLogging)
    window.addEventListener('scroll-to-workspace', handleScrollToWorkspace)

    return () => {
      window.griptapeAPI.removeWorkspaceChanged(handleWorkspaceChanged)
      window.pythonAPI.removeEnvironmentInfoUpdated(handleEnvironmentInfoUpdated)
      window.removeEventListener('scroll-to-updates', handleScrollToUpdates)
      window.removeEventListener('scroll-to-engine-updates', handleScrollToEngineUpdates)
      window.removeEventListener('scroll-to-logging', handleScrollToLogging)
      window.removeEventListener('scroll-to-workspace', handleScrollToWorkspace)
    }
  }, [loadEnvironmentInfo])

  // Auto-refresh environment info when engine starts after upgrade/channel switch
  useEffect(() => {
    if (status === 'running' && isUpgradePending) {
      // Wait for engine to fully stabilize before refreshing
      const timeoutId = setTimeout(async () => {
        // Guard against refreshing during channel switch
        const isChannelSwitching = await window.settingsAPI.isChannelSwitchInProgress()
        if (isChannelSwitching) {
          return
        }

        await handleRefreshEnvironmentInfo()
        setOperationMessage({ type: 'success', text: 'Operation completed successfully!' })
        setIsUpgradePending(false)

        // Auto-clear success message after 5 seconds
        setTimeout(() => {
          setOperationMessage(null)
        }, 5000)
      }, 2000)

      return () => clearTimeout(timeoutId)
    }
  }, [
    status,
    isUpgradePending,
    handleRefreshEnvironmentInfo,
    setIsUpgradePending,
    setOperationMessage
  ])

  const loadEngineChannel = async () => {
    try {
      const channel = await window.settingsAPI.getEngineChannel()
      setEngineChannel(channel)
    } catch (err) {
      console.error('Failed to load engine channel:', err)
    }
  }

  const loadEditorChannel = async () => {
    try {
      const channel = await window.settingsAPI.getEditorChannel()
      setEditorChannel(channel)
    } catch (err) {
      console.error('Failed to load editor channel:', err)
    }
  }

  const checkDevMode = async () => {
    try {
      const packaged = await window.electronAPI.isPackaged()
      setShowLocalOption(!packaged)
    } catch (err) {
      console.error('Failed to check dev mode:', err)
    }
  }

  const loadLocalEnginePath = async () => {
    setLoadingLocalEnginePath(true)
    try {
      const path = await window.settingsAPI.getLocalEnginePath()
      setLocalEnginePath(path)
    } catch (err) {
      console.error('Failed to load local engine path:', err)
    } finally {
      setLoadingLocalEnginePath(false)
    }
  }

  const handleSelectLocalEnginePath = async () => {
    try {
      const result = await window.settingsAPI.selectLocalEnginePath()
      if (result.success && result.path) {
        setLocalEnginePath(result.path)
      }
    } catch (err) {
      console.error('Failed to select local engine path:', err)
    }
  }

  const handleClearLocalEnginePath = async () => {
    try {
      const result = await window.settingsAPI.setLocalEnginePath(null)
      if (result.success) {
        setLocalEnginePath(null)
      }
    } catch (err) {
      console.error('Failed to clear local engine path:', err)
    }
  }

  const loadSystemMonitorSetting = async () => {
    try {
      const show = await window.settingsAPI.getShowSystemMonitor()
      setShowSystemMonitor(show)
    } catch (err) {
      console.error('Failed to load system monitor setting:', err)
    }
  }

  const handleToggleSystemMonitor = async (checked: boolean) => {
    setShowSystemMonitor(checked)
    try {
      await window.settingsAPI.setShowSystemMonitor(checked)
      // Emit event so MainApp can update
      window.dispatchEvent(new CustomEvent('system-monitor-toggle', { detail: checked }))
    } catch (err) {
      console.error('Failed to save system monitor setting:', err)
      // Revert on error
      setShowSystemMonitor(!checked)
    }
  }

  const loadConfirmOnCloseSetting = async () => {
    try {
      const confirm = await window.settingsAPI.getConfirmOnClose()
      setConfirmOnClose(confirm)
    } catch (err) {
      console.error('Failed to load confirm on close setting:', err)
    }
  }

  const handleToggleConfirmOnClose = async (checked: boolean) => {
    setConfirmOnClose(checked)
    try {
      await window.settingsAPI.setConfirmOnClose(checked)
    } catch (err) {
      console.error('Failed to save confirm on close setting:', err)
      // Revert on error
      setConfirmOnClose(!checked)
    }
  }

  const loadShowReleaseNotesSetting = async () => {
    try {
      const show = await window.settingsAPI.getShowReleaseNotes()
      setShowReleaseNotes(show)
    } catch (err) {
      console.error('Failed to load show release notes setting:', err)
    }
  }

  const handleToggleShowReleaseNotes = async (checked: boolean) => {
    setShowReleaseNotes(checked)
    try {
      await window.settingsAPI.setShowReleaseNotes(checked)
    } catch (err) {
      console.error('Failed to save show release notes setting:', err)
      // Revert on error
      setShowReleaseNotes(!checked)
    }
  }

  const loadEngineLogFileSetting = async () => {
    try {
      const enabled = await window.settingsAPI.getEngineLogFileEnabled()
      setEngineLogFileEnabled(enabled)
    } catch (err) {
      console.error('Failed to load engine log file setting:', err)
    }
  }

  const handleToggleEngineLogFile = async (checked: boolean) => {
    setEngineLogFileEnabled(checked)
    try {
      await window.settingsAPI.setEngineLogFileEnabled(checked)
    } catch (err) {
      console.error('Failed to save engine log file setting:', err)
      // Revert on error
      setEngineLogFileEnabled(!checked)
    }
  }

  const loadUpdateBehaviorSetting = async () => {
    try {
      const behavior = await window.settingsAPI.getUpdateBehavior()
      setUpdateBehavior(behavior)
    } catch (err) {
      console.error('Failed to load update behavior setting:', err)
    }
  }

  const loadEngineUpdateBehaviorSetting = async () => {
    try {
      const behavior = await window.settingsAPI.getEngineUpdateBehavior()
      setEngineUpdateBehavior(behavior)
    } catch (err) {
      console.error('Failed to load engine update behavior setting:', err)
    }
  }

  const handleUpdateBehaviorChange = async (newBehavior: UpdateBehavior) => {
    const previousBehavior = updateBehavior
    setUpdateBehavior(newBehavior)
    try {
      await window.settingsAPI.setUpdateBehavior(newBehavior)
    } catch (err) {
      console.error('Failed to save update behavior setting:', err)
      // Revert on error
      setUpdateBehavior(previousBehavior)
    }
  }

  const handleEngineUpdateBehaviorChange = async (newBehavior: UpdateBehavior) => {
    const previousBehavior = engineUpdateBehavior
    setEngineUpdateBehavior(newBehavior)
    try {
      await window.settingsAPI.setEngineUpdateBehavior(newBehavior)
    } catch (err) {
      console.error('Failed to save engine update behavior setting:', err)
      // Revert on error
      setEngineUpdateBehavior(previousBehavior)
    }
  }

  const loadLibrarySettings = async () => {
    setLoadingLibrarySettings(true)
    try {
      const [advanced, cloud] = await Promise.all([
        window.onboardingAPI.isAdvancedLibraryEnabled(),
        window.onboardingAPI.isCloudLibraryEnabled()
      ])
      setAdvancedLibrary(advanced)
      setCloudLibrary(cloud)
      setPendingAdvancedLibrary(advanced)
      setPendingCloudLibrary(cloud)
    } catch (err) {
      console.error('Failed to load library settings:', err)
    } finally {
      setLoadingLibrarySettings(false)
    }
  }

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setNotification({ type: 'success', text: 'API Key copied to clipboard!' })
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  const loadWorkspaceDirectory = async () => {
    try {
      const directory = await window.griptapeAPI.getWorkspace()
      setWorkspaceDir(directory)
      setPendingWorkspaceDir(directory)
    } catch (err) {
      console.error('Failed to load workspace directory:', err)
    } finally {
      setLoadingWorkspace(false)
    }
  }

  const handleSelectWorkspace = async () => {
    try {
      const directory = await window.griptapeAPI.selectDirectory()
      if (directory) {
        setPendingWorkspaceDir(directory)
        checkForUnsavedChanges(directory, pendingAdvancedLibrary, pendingCloudLibrary)
      }
    } catch (err) {
      console.error('Failed to select directory:', err)
    }
  }

  const handleAdvancedLibraryChange = (checked: boolean) => {
    setPendingAdvancedLibrary(checked)
    checkForUnsavedChanges(pendingWorkspaceDir, checked, pendingCloudLibrary)
  }

  const handleCloudLibraryChange = (checked: boolean) => {
    setPendingCloudLibrary(checked)
    checkForUnsavedChanges(pendingWorkspaceDir, pendingAdvancedLibrary, checked)
  }

  const checkForUnsavedChanges = (workspace: string, advanced: boolean, cloud: boolean) => {
    const workspaceChanged = workspace !== workspaceDir
    const advancedChanged = advanced !== advancedLibrary
    const cloudChanged = cloud !== cloudLibrary
    setHasUnsavedChanges(workspaceChanged || advancedChanged || cloudChanged)
  }

  const handleApplyChanges = async () => {
    setIsApplyingChanges(true)
    setOperationMessage({
      type: 'info',
      text: 'Applying changes and reconfiguring engine...'
    })

    try {
      await window.griptapeAPI.reconfigureEngine({
        workspaceDirectory: pendingWorkspaceDir,
        advancedLibrary: pendingAdvancedLibrary,
        cloudLibrary: pendingCloudLibrary
      })

      // Update current state to match pending
      setWorkspaceDir(pendingWorkspaceDir)
      setAdvancedLibrary(pendingAdvancedLibrary)
      setCloudLibrary(pendingCloudLibrary)
      setHasUnsavedChanges(false)

      // Mark as pending so environment info refreshes when engine restarts
      setIsUpgradePending(true)

      setOperationMessage({
        type: 'success',
        text: 'Settings applied successfully! Engine restarting...'
      })

      // Clear success message after 5 seconds
      setTimeout(() => setOperationMessage(null), 5000)
    } catch (err) {
      console.error('Failed to apply settings:', err)
      setOperationMessage({
        type: 'error',
        text: 'Failed to apply settings. Please try again.'
      })
    } finally {
      setIsApplyingChanges(false)
    }
  }

  const loadUpdateInfo = async () => {
    try {
      const results = await Promise.allSettled([
        window.velopackApi.getVersion(),
        window.velopackApi.getChannel(),
        window.velopackApi.getAvailableChannels(),
        window.updateAPI.isSupported()
      ])

      const [versionResult, channelResult, channelsResult, supportedResult] = results

      if (supportedResult.status === 'fulfilled') {
        setUpdatesSupported(supportedResult.value)
      } else {
        console.error('Failed to check if updates are supported:', supportedResult.reason)
      }

      if (versionResult.status === 'fulfilled') {
        setCurrentVersion(versionResult.value)
        setVersionError(false)
      } else {
        console.error('Failed to get version:', versionResult.reason)
        setVersionError(true)
      }

      if (channelResult.status === 'fulfilled') {
        setCurrentChannel(channelResult.value)
        setChannelError(false)
      } else {
        console.error('Failed to get channel:', channelResult.reason)
        setChannelError(true)
      }

      if (channelsResult.status === 'fulfilled') {
        const channels = channelsResult.value
        setAvailableChannels(channels)
        setChannelsError(false)

        // Load logical display names for each channel
        const displayNames = new Map<string, string>()
        await Promise.all(
          channels.map(async (channel) => {
            try {
              const logicalName = await window.velopackApi.getLogicalChannelName(channel)
              displayNames.set(channel, logicalName)
            } catch (err) {
              console.error(`Failed to get logical name for channel ${channel}:`, err)
              displayNames.set(channel, channel)
            }
          })
        )
        setChannelDisplayNames(displayNames)
      } else {
        console.error('Failed to get available channels:', channelsResult.reason)
        setChannelsError(true)
      }
    } catch (err) {
      console.error('Failed to load update info:', err)
    }
  }

  const handleChannelChange = async (newChannel: string) => {
    try {
      await window.velopackApi.setChannel(newChannel)
      setCurrentChannel(newChannel)
    } catch (err) {
      console.error('Failed to change channel:', err)
      setNotification({ type: 'error', text: 'Failed to change update channel' })
    }
  }

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true)
    try {
      await window.updateAPI.checkForUpdates()
    } catch (err) {
      console.error('Failed to check for updates:', err)
    } finally {
      setCheckingForUpdates(false)
    }
  }

  const handleEngineChannelChange = async (newChannel: 'stable' | 'nightly') => {
    setSwitchingChannel(true)
    setIsUpgradePending(true)
    setOperationMessage(null)
    setOperationMessage({
      type: 'info',
      text: `Switching to ${newChannel} channel...`
    })

    try {
      const result = await window.settingsAPI.setEngineChannel(newChannel)
      if (result && result.success) {
        setEngineChannel(newChannel)
        setOperationMessage({
          type: 'info',
          text: `Successfully switched to ${newChannel} channel! Engine is restarting...`
        })
      } else {
        setOperationMessage({
          type: 'error',
          text: `Failed to switch channel: ${result?.error || 'Unknown error'}`
        })
        setIsUpgradePending(false)
      }
    } catch (err) {
      console.error('Failed to switch engine channel:', err)
      setOperationMessage({
        type: 'error',
        text: `Failed to switch channel: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
      setIsUpgradePending(false)
    } finally {
      setSwitchingChannel(false)
    }
  }

  const handleEditorChannelChange = async (newChannel: 'stable' | 'nightly' | 'local') => {
    try {
      const result = await window.settingsAPI.setEditorChannel(newChannel)
      if (result && result.success) {
        setEditorChannel(newChannel)
        // Trigger a reload of the editor webview to apply the new channel
        window.editorAPI.requestReloadWebview()
      }
    } catch (err) {
      console.error('Failed to switch editor channel:', err)
      setNotification({ type: 'error', text: 'Failed to switch editor channel' })
    }
  }

  const handleUpgradeEngine = async () => {
    setUpgradingEngine(true)
    setIsUpgradePending(true)
    setOperationMessage(null)

    const wasRunning = status === 'running'

    try {
      // Stop engine if running
      if (wasRunning) {
        setOperationMessage({
          type: 'info',
          text: 'Stopping engine...'
        })
        const stopResult = await window.engineAPI.stop()
        if (!stopResult || !stopResult.success) {
          setOperationMessage({
            type: 'error',
            text: `Failed to stop engine: ${stopResult?.error || 'Unknown error'}`
          })
          setUpgradingEngine(false)
          setIsUpgradePending(false)
          return
        }
        // Wait a moment for engine to fully stop
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      // Upgrade engine
      setOperationMessage({
        type: 'info',
        text: 'Upgrading engine...'
      })
      const result = await window.griptapeAPI.upgrade()
      if (result && result.success) {
        // Always start/restart the engine after upgrade
        setOperationMessage({
          type: 'info',
          text: wasRunning
            ? 'Engine upgraded successfully! Restarting engine...'
            : 'Engine upgraded successfully! Starting engine...'
        })
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const startResult = await window.engineAPI.start()
        if (!startResult || !startResult.success) {
          setOperationMessage({
            type: 'error',
            text: `Engine upgraded but failed to ${wasRunning ? 'restart' : 'start'}: ${startResult?.error || 'Unknown error'}`
          })
          setIsUpgradePending(false)
        }
      } else {
        setOperationMessage({
          type: 'error',
          text: `Upgrade failed: ${result?.error || 'Unknown error'}`
        })
        setIsUpgradePending(false)
      }
    } catch (err) {
      console.error('Failed to upgrade engine:', err)
      setOperationMessage({
        type: 'error',
        text: 'Failed to upgrade engine'
      })
      setIsUpgradePending(false)
    } finally {
      setUpgradingEngine(false)
    }
  }

  const handleReinstallConfirm = useCallback(async () => {
    setShowReinstallDialog(false)
    setIsUpgradePending(true)
    await reinstallEngine()
    // Refresh environment info after reinstall completes
    setTimeout(() => {
      handleRefreshEnvironmentInfo()
    }, 2000)
  }, [reinstallEngine, setIsUpgradePending, handleRefreshEnvironmentInfo])

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ] as const

  return (
    <div className="h-full overflow-y-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            className={cn(
              'px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2',
              notification.type === 'success' &&
                'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-500',
              notification.type === 'error' &&
                'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-500',
              notification.type === 'info' &&
                'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-500'
            )}
          >
            <span className="text-sm font-medium">{notification.text}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* General Section */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">General</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={confirmOnClose}
                onChange={(e) => handleToggleConfirmOnClose(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
              <div className="flex-1">
                <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                  Confirm before closing
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Show a confirmation dialog when closing the application. The engine will be
                  stopped when you quit.
                </p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={showReleaseNotes}
                onChange={(e) => handleToggleShowReleaseNotes(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
              <div className="flex-1">
                <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                  Show release notes after updates
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Display a summary of changes when the app is updated to a new version.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Appearance</h2>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-3">Choose your preferred theme</p>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all',
                        theme === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/50'
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* System Monitor Toggle */}
            <div className="pt-4 border-t border-border">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={showSystemMonitor}
                  onChange={(e) => handleToggleSystemMonitor(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                    Show system monitor
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Display CPU, memory, and GPU utilization in a subheader below the main
                    navigation. Updates every second.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Logging and Diagnostics Section */}
        <div
          id="logging-diagnostics"
          className="bg-card rounded-lg shadow-sm border border-border p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Logging and Diagnostics</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={engineLogFileEnabled}
                onChange={(e) => handleToggleEngineLogFile(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
              <div className="flex-1">
                <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                  Write engine logs to file
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Save engine output to a log file for troubleshooting. Logs are automatically
                  rotated when they reach 10MB. When enabled, you can export logs from the Engine
                  page.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Workspace & Library Configuration Section */}
        <div
          id="workspace-settings"
          className="bg-card rounded-lg shadow-sm border border-border p-6 transition-all"
        >
          <h2 className="text-lg font-semibold mb-4">Workspace & Libraries</h2>
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Workspace Directory</label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  This is where Griptape Nodes will store your workflows and data.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={loadingWorkspace ? '' : pendingWorkspaceDir}
                  readOnly
                  className={cn(
                    'flex-1 px-3 py-2 text-sm rounded-md',
                    'bg-background border border-input',
                    'font-mono'
                  )}
                  placeholder={
                    loadingWorkspace
                      ? 'Loading workspace directory...'
                      : 'No workspace directory set'
                  }
                />
                <button
                  onClick={handleSelectWorkspace}
                  disabled={isApplyingChanges || loadingWorkspace}
                  className={cn(
                    'px-4 py-2 text-sm rounded-md',
                    'bg-primary text-primary-foreground',
                    'hover:bg-primary/90 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Additional Libraries
                  </label>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Install additional libraries to extend Griptape Nodes capabilities
                  </p>
                </div>

                {loadingLibrarySettings ? (
                  <p className="text-sm text-muted-foreground">Loading library settings...</p>
                ) : (
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={pendingAdvancedLibrary}
                        onChange={(e) => handleAdvancedLibraryChange(e.target.checked)}
                        disabled={isApplyingChanges}
                        className={cn(
                          'mt-0.5 w-4 h-4 rounded border-input',
                          'text-purple-600 focus:ring-purple-500 focus:ring-offset-0',
                          'bg-background cursor-pointer',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      />
                      <div className="flex-1 space-y-1">
                        <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                          Install Advanced Media Library
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Advanced image processing nodes (requires specific models to function)
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={pendingCloudLibrary}
                        onChange={(e) => handleCloudLibraryChange(e.target.checked)}
                        disabled={isApplyingChanges}
                        className={cn(
                          'mt-0.5 w-4 h-4 rounded border-input',
                          'text-purple-600 focus:ring-purple-500 focus:ring-offset-0',
                          'bg-background cursor-pointer',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      />
                      <div className="flex-1 space-y-1">
                        <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                          Install Griptape Cloud Library
                        </span>
                        <p className="text-xs text-muted-foreground">
                          Nodes for integrating with Griptape Cloud services
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Apply Changes Button */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={handleApplyChanges}
                disabled={
                  !hasUnsavedChanges ||
                  isApplyingChanges ||
                  loadingWorkspace ||
                  loadingLibrarySettings
                }
                className={cn(
                  'w-full px-4 py-3 text-sm font-medium rounded-md',
                  'bg-green-600 hover:bg-green-500 active:bg-green-400',
                  'text-white transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isApplyingChanges ? 'Applying Changes...' : 'Apply Changes'}
              </button>
              {hasUnsavedChanges && !isApplyingChanges && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  You have unsaved changes. Click Apply Changes to reconfigure the engine.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Applying changes will stop the engine, reconfigure settings, and restart.
              </p>
            </div>
          </div>
        </div>

        {/* API Key Section */}
        {apiKey && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">Griptape Cloud API Key</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                  className={cn(
                    'flex-1 px-3 py-2 text-sm rounded-md',
                    'bg-background border border-input',
                    'font-mono'
                  )}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className={cn(
                    'px-4 py-2 text-sm rounded-md',
                    'bg-secondary text-secondary-foreground',
                    'hover:bg-secondary/80 transition-colors'
                  )}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={copyApiKey}
                  className={cn(
                    'px-4 py-2 text-sm rounded-md',
                    'bg-primary text-primary-foreground',
                    'hover:bg-primary/90 transition-colors'
                  )}
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                This API key provides access to Griptape Cloud services. Keep it secure!
              </p>
            </div>
          </div>
        )}

        {/* Engine Updates Section */}
        <div id="engine-updates" className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Engine Updates</h2>
          <div className="space-y-4">
            {/* Engine Channel Selector */}
            <div>
              <p className="text-sm font-medium mb-2">Engine Channel</p>
              <select
                value={engineChannel}
                onChange={(e) => handleEngineChannelChange(e.target.value as 'stable' | 'nightly')}
                disabled={switchingChannel || upgradingEngine}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-md',
                  'bg-background border border-input',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <option value="stable">Stable (PyPI releases)</option>
                <option value="nightly">Nightly (Latest development build)</option>
              </select>
              <ChannelDescription />
            </div>

            {/* Engine Update Behavior Dropdown */}
            <div>
              <p className="text-sm font-medium mb-2">Update Behavior</p>
              <select
                value={engineUpdateBehavior}
                onChange={(e) => handleEngineUpdateBehaviorChange(e.target.value as UpdateBehavior)}
                disabled={switchingChannel || upgradingEngine}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-md',
                  'bg-background border border-input',
                  'focus:outline-none focus:ring-2 focus:ring-ring',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <option value="auto-update">Auto-Update</option>
                <option value="prompt">Prompt for Update</option>
                <option value="silence">Silence Updates</option>
              </select>
              <UpdateBehaviorDescription />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current Engine Version</p>
                <p className="text-sm text-muted-foreground">
                  {environmentInfo?.griptapeNodes?.version || 'Loading...'}
                </p>
              </div>
              <button
                onClick={handleUpgradeEngine}
                disabled={upgradingEngine || !environmentInfo?.griptapeNodes?.installed}
                className={cn(
                  'px-4 py-2 text-sm rounded-md',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {upgradingEngine ? 'Upgrading...' : 'Update Engine'}
              </button>
            </div>

            {/* Update Message */}
            {operationMessage && (
              <div
                className={cn(
                  'p-3 rounded-md border',
                  operationMessage.type === 'success' &&
                    'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-500',
                  operationMessage.type === 'error' &&
                    'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-500',
                  operationMessage.type === 'info' &&
                    'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-500'
                )}
              >
                <p className="text-sm font-medium">{operationMessage.text}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              The engine (Griptape Nodes) provides the core functionality for running workflows.
              Click &ldquo;Update Engine&rdquo; to upgrade to the latest version. The engine will be
              automatically stopped and restarted during the upgrade.
            </p>

            {/* Advanced/Troubleshooting Collapsible Section */}
            <div className="pt-4 border-t border-border">
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center justify-between w-full text-left"
              >
                <span className="text-sm font-medium">Advanced Options</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform',
                    showAdvancedOptions && 'transform rotate-180'
                  )}
                />
              </button>

              {showAdvancedOptions && (
                <div className="mt-3 space-y-4">
                  {/* Local Engine Development */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Local Engine Development
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      Run the engine from a local griptape-nodes repository instead of the installed
                      version. Useful for testing local changes.
                    </p>
                    {loadingLocalEnginePath ? (
                      <p className="text-sm text-blue-600 dark:text-blue-400">Loading...</p>
                    ) : localEnginePath ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={localEnginePath}
                            readOnly
                            className={cn(
                              'flex-1 px-3 py-2 text-sm rounded-md',
                              'bg-background border border-blue-300 dark:border-blue-700',
                              'font-mono text-xs'
                            )}
                          />
                          <button
                            onClick={handleClearLocalEnginePath}
                            className={cn(
                              'p-2 text-sm rounded-md',
                              'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                              'hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors'
                            )}
                            title="Clear local engine path"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Engine will run from this local repository. Restart the engine to apply.
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={handleSelectLocalEnginePath}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2 text-sm rounded-md',
                          'bg-blue-500 text-white',
                          'hover:bg-blue-600 transition-colors'
                        )}
                      >
                        <FolderOpen className="w-4 h-4" />
                        Select Local Repository
                      </button>
                    )}
                  </div>

                  {/* Troubleshooting */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      Troubleshooting
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                      If the engine is failing to start or behaving unexpectedly, you can perform a
                      full reinstallation of the Python environment and engine components. Your
                      settings will be preserved.
                    </p>
                    <button
                      onClick={() => setShowReinstallDialog(true)}
                      disabled={upgradingEngine || isUpgradePending}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 text-sm rounded-md',
                        'bg-orange-500 text-white',
                        'hover:bg-orange-600 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reinstall Engine Components
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editor Channel Section */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Editor Channel</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Editor Release Channel</p>
              <select
                value={editorChannel}
                onChange={(e) =>
                  handleEditorChannelChange(e.target.value as 'stable' | 'nightly' | 'local')
                }
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-md',
                  'bg-background border border-input',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
              >
                <option value="stable">Stable</option>
                <option value="nightly">Nightly</option>
                {showLocalOption && <option value="local">Local Development</option>}
              </select>
              <ChannelDescription>
                {showLocalOption && (
                  <>
                    <br />
                    Local: Development editor running on localhost:5173.
                  </>
                )}
              </ChannelDescription>
            </div>
          </div>
        </div>

        {/* Release Channel Section */}
        <div
          id="desktop-app-updates"
          className="bg-card rounded-lg shadow-sm border border-border p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Desktop App Release Channel</h2>
          {!updatesSupported && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4 mb-4">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                Release channel switching and updates are not available in development mode.
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Current Version</p>
                <p
                  className={cn(
                    'text-sm',
                    versionError ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {versionError ? 'Failed to load version' : currentVersion || 'Loading...'}
                </p>
              </div>
              <button
                onClick={handleCheckForUpdates}
                disabled={!updatesSupported || checkingForUpdates}
                className={cn(
                  'px-4 py-2 text-sm rounded-md',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {checkingForUpdates ? 'Checking...' : 'Check for Updates'}
              </button>
            </div>

            {/* Update Behavior Dropdown */}
            <div className="pt-4 border-t border-border">
              <div>
                <p className="text-sm font-medium mb-2">Update Behavior</p>
                <select
                  value={updateBehavior}
                  onChange={(e) => handleUpdateBehaviorChange(e.target.value as UpdateBehavior)}
                  disabled={!updatesSupported}
                  className={cn(
                    'w-full px-3 py-2 text-sm rounded-md',
                    'bg-background border border-input',
                    'focus:outline-none focus:ring-2 focus:ring-ring',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <option value="auto-update">Auto-Update</option>
                  <option value="prompt">Prompt for Update</option>
                  <option value="silence">Silence Updates</option>
                </select>
                <UpdateBehaviorDescription />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Change Desktop App Release Channel</p>
              {channelsError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-2">
                  <p className="text-xs text-destructive">Failed to load available channels</p>
                </div>
              )}
              <select
                value={currentChannel}
                onChange={(e) => handleChannelChange(e.target.value)}
                disabled={!updatesSupported || channelError || channelsError}
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-md',
                  'bg-background border',
                  channelError || channelsError ? 'border-destructive' : 'border-input',
                  'focus:outline-none focus:ring-2 focus:ring-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {availableChannels.length > 0 ? (
                  availableChannels.map((channel) => {
                    const displayName = channelDisplayNames.get(channel) || channel
                    const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1)
                    return (
                      <option key={channel} value={channel}>
                        {formattedName}
                      </option>
                    )
                  })
                ) : (
                  <option value="">No channels available</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Changing the channel will affect which updates you receive
              </p>
            </div>
          </div>
        </div>

        {/* Environment Information */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Environment Information</h2>
            <button
              onClick={handleRefreshEnvironmentInfo}
              disabled={refreshing || loading}
              className={cn(
                'px-4 py-2 text-sm rounded-md',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading environment information...</p>
          ) : error ? (
            <div className="text-destructive">{error}</div>
          ) : environmentInfo ? (
            <div className="space-y-6">
              {/* Desktop App */}
              {environmentInfo.build && (
                <div>
                  <h3 className="text-md font-semibold mb-3">Desktop App</h3>
                  <div className="bg-muted rounded-md p-4 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Version:</span> {environmentInfo.build.version}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Commit:</span>{' '}
                      <code className="text-xs bg-background px-1 py-0.5 rounded">
                        {environmentInfo.build.commitHash.substring(0, 8)}
                      </code>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Branch:</span> {environmentInfo.build.branch}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Build ID:</span>{' '}
                      <code className="text-xs bg-background px-1 py-0.5 rounded">
                        {environmentInfo.build.buildId}
                      </code>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Build Date:</span>{' '}
                      {formatDate(environmentInfo.build.buildDate)}
                    </p>
                  </div>
                </div>
              )}

              {/* Python Information */}
              <div>
                <h3 className="text-md font-semibold mb-3">Python</h3>
                <div className="bg-muted rounded-md p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Version:</span> {environmentInfo.python.version}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Executable:</span>{' '}
                    <code className="text-xs bg-background px-1 py-0.5 rounded">
                      {environmentInfo.python.executable}
                    </code>
                  </p>
                  {environmentInfo.python.installedPackages && (
                    <details className="text-sm">
                      <summary className="font-medium cursor-pointer">
                        Installed Packages ({environmentInfo.python.installedPackages.length})
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <pre className="text-xs bg-background p-2 rounded">
                          {environmentInfo.python.installedPackages.join('\n')}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Griptape Nodes Information */}
              <div>
                <h3 className="text-md font-semibold mb-3">Griptape Nodes</h3>
                <div className="bg-muted rounded-md p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span>{' '}
                    <span
                      className={cn(
                        'font-medium',
                        environmentInfo.griptapeNodes.installed
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      )}
                    >
                      {environmentInfo.griptapeNodes.installed ? 'Installed' : 'Not Installed'}
                    </span>
                  </p>
                  {environmentInfo.griptapeNodes.installed && (
                    <>
                      <p className="text-sm">
                        <span className="font-medium">Version:</span>{' '}
                        {environmentInfo.griptapeNodes.version}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Path:</span>{' '}
                        <code className="text-xs bg-background px-1 py-0.5 rounded">
                          {environmentInfo.griptapeNodes.path}
                        </code>
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* UV Information */}
              <div>
                <h3 className="text-md font-semibold mb-3">UV Package Manager</h3>
                <div className="bg-muted rounded-md p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Version:</span> {environmentInfo.uv.version}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Tool Directory:</span>{' '}
                    <code className="text-xs bg-background px-1 py-0.5 rounded">
                      {environmentInfo.uv.toolDir}
                    </code>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Python Install Directory:</span>{' '}
                    <code className="text-xs bg-background px-1 py-0.5 rounded">
                      {environmentInfo.uv.pythonInstallDir}
                    </code>
                  </p>
                </div>
              </div>

              {/* System Information */}
              <div>
                <h3 className="text-md font-semibold mb-3">System</h3>
                <div className="bg-muted rounded-md p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Platform:</span> {environmentInfo.system.platform}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Architecture:</span> {environmentInfo.system.arch}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Node Version:</span>{' '}
                    {environmentInfo.system.nodeVersion}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Electron Version:</span>{' '}
                    {environmentInfo.system.electronVersion}
                  </p>
                </div>
              </div>

              {/* Collection Info */}
              <div className="text-xs text-muted-foreground">
                <p>Last updated: {formatDate(environmentInfo.collectedAt)}</p>
                {environmentInfo.errors && environmentInfo.errors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-yellow-600">
                      Warnings ({environmentInfo.errors.length})
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {environmentInfo.errors.map((error: string) => (
                        <li key={error} className="text-yellow-600">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Environment information not yet collected. Click Refresh to collect it now.
            </p>
          )}
        </div>
      </div>

      {/* Reinstall Confirmation Dialog */}
      {showReinstallDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Reinstall Engine Components?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will completely reinstall the Python environment, UV package manager, and
              Griptape Nodes engine. Use this if the engine is failing to start or behaving
              unexpectedly.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>What will be preserved:</strong> Your workspace, API key, and library
              preferences.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> The engine will be stopped during this process. Any
                running workflows will be interrupted.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReinstallDialog(false)}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReinstallConfirm}
                className="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                Reinstall
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
