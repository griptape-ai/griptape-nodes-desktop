import { Moon, Sun, Monitor } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useEngine } from '../contexts/EngineContext'
import { useTheme } from '../contexts/ThemeContext'
import { cn } from '../utils/utils'
import { ENV_INFO_NOT_COLLECTED } from '@/common/config/constants'

const Settings: React.FC = () => {
  const { apiKey } = useAuth()
  const { status, isUpgradePending, setIsUpgradePending, operationMessage, setOperationMessage } = useEngine()
  const { theme, setTheme } = useTheme()
  const [environmentInfo, setEnvironmentInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceDir, setWorkspaceDir] = useState<string>('')
  const [updatingWorkspace, setUpdatingWorkspace] = useState(false)
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
  const [upgradingEngine, setUpgradingEngine] = useState(false)
  const [showSystemMonitor, setShowSystemMonitor] = useState(false)
  const [engineChannel, setEngineChannel] = useState<'stable' | 'nightly'>('stable')
  const [switchingChannel, setSwitchingChannel] = useState(false)

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
    loadUpdateInfo()
    loadSystemMonitorSetting()
    loadEngineChannel()
    window.griptapeAPI.refreshConfig()

    const handleWorkspaceChanged = (event: any, directory: string) => {
      setWorkspaceDir(directory)
      setLoadingWorkspace(false)
    }

    window.griptapeAPI.onWorkspaceChanged(handleWorkspaceChanged)

    return () => {
      window.griptapeAPI.removeWorkspaceChanged(handleWorkspaceChanged)
    }
  }, [loadEnvironmentInfo])

  // Auto-refresh environment info when engine starts after upgrade/channel switch
  useEffect(() => {
    if (status === 'running' && isUpgradePending) {
      // Wait for engine to fully stabilize before refreshing
      const timeoutId = setTimeout(async () => {
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
  }, [status, isUpgradePending, handleRefreshEnvironmentInfo, setIsUpgradePending, setOperationMessage])

  const loadEngineChannel = async () => {
    try {
      const channel = await window.settingsAPI.getEngineChannel()
      setEngineChannel(channel)
    } catch (err) {
      console.error('Failed to load engine channel:', err)
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

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      alert('API Key copied to clipboard!')
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
        setWorkspaceDir(directory)
        await updateWorkspace(directory)
      }
    } catch (err) {
      console.error('Failed to select directory:', err)
    }
  }

  const updateWorkspace = async (directory: string) => {
    setUpdatingWorkspace(true)
    try {
      await window.griptapeAPI.setWorkspace(directory)
    } catch (err) {
      console.error('Failed to update workspace:', err)
      alert('Failed to update workspace directory')
    } finally {
      setUpdatingWorkspace(false)
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
      alert('Failed to change update channel')
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

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor }
  ] as const

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
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

        {/* Workspace Directory Section */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Workspace Directory</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This is where Griptape Nodes will store your workflows and data.
              <br />
              Changing the workspace directory will trigger an engine restart.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={loadingWorkspace ? '' : workspaceDir}
                readOnly
                className={cn(
                  'flex-1 px-3 py-2 text-sm rounded-md',
                  'bg-background border border-input',
                  'font-mono'
                )}
                placeholder={
                  loadingWorkspace ? 'Loading workspace directory...' : 'No workspace directory set'
                }
              />
              <button
                onClick={handleSelectWorkspace}
                disabled={updatingWorkspace}
                className={cn(
                  'px-4 py-2 text-sm rounded-md',
                  'bg-primary text-primary-foreground',
                  'hover:bg-primary/90 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {updatingWorkspace ? 'Updating...' : 'Browse'}
              </button>
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
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
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
              <p className="text-xs text-muted-foreground mt-1">
                Stable: Official releases from PyPI. Nightly: Latest development build from GitHub
                (may be unstable).
              </p>
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
          </div>
        </div>

        {/* Release Channel Section */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Release Channel</h2>
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

            <div>
              <p className="text-sm font-medium mb-2">Change Release Channel</p>
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
                      {environmentInfo.errors.map((error: string, index: number) => (
                        <li key={index} className="text-yellow-600">
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
    </div>
  )
}

export default Settings
