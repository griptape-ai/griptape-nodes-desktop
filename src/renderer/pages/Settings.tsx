import { Moon, Sun, Monitor } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../utils/utils';

const Settings: React.FC = () => {
  const { apiKey } = useAuth();
  const { theme, setTheme } = useTheme();
  const [environmentInfo, setEnvironmentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceDir, setWorkspaceDir] = useState<string>('');
  const [updatingWorkspace, setUpdatingWorkspace] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [currentChannel, setCurrentChannel] = useState<string>('');
  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [channelDisplayNames, setChannelDisplayNames] = useState<Map<string, string>>(new Map());
  const [updatesSupported, setUpdatesSupported] = useState<boolean>(false);
  const [checkingForUpdates, setCheckingForUpdates] = useState(false);
  const [versionError, setVersionError] = useState<boolean>(false);
  const [channelError, setChannelError] = useState<boolean>(false);
  const [channelsError, setChannelsError] = useState<boolean>(false);

  useEffect(() => {
    loadEnvironmentInfo();
    loadWorkspaceDirectory();
    loadUpdateInfo();
    window.griptapeAPI.refreshConfig();

    const handleWorkspaceChanged = (event: any, directory: string) => {
      setWorkspaceDir(directory);
      setLoadingWorkspace(false);
    };

    window.griptapeAPI.onWorkspaceChanged(handleWorkspaceChanged);

    return () => {
      window.griptapeAPI.removeWorkspaceChanged(handleWorkspaceChanged);
    };
  }, []);

  const loadEnvironmentInfo = async () => {
    try {
      setError(null);
      const result = await window.pythonAPI.getEnvironmentInfo();

      if (result.success && result.data) {
        setEnvironmentInfo(result.data);
      } else {
        setError(result.error || 'Failed to load environment information');
      }
    } catch (err) {
      console.error('Failed to load environment info:', err);
      setError('Failed to load environment information');
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      alert('API Key copied to clipboard!');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const loadWorkspaceDirectory = async () => {
    try {
      const directory = await window.griptapeAPI.getWorkspace();
      setWorkspaceDir(directory);
    } catch (err) {
      console.error('Failed to load workspace directory:', err);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handleSelectWorkspace = async () => {
    try {
      const directory = await window.griptapeAPI.selectDirectory();
      if (directory) {
        setWorkspaceDir(directory);
        await updateWorkspace(directory);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  const updateWorkspace = async (directory: string) => {
    setUpdatingWorkspace(true);
    try {
      await window.griptapeAPI.setWorkspace(directory);
    } catch (err) {
      console.error('Failed to update workspace:', err);
      alert('Failed to update workspace directory');
    } finally {
      setUpdatingWorkspace(false);
    }
  };

  const loadUpdateInfo = async () => {
    try {
      const results = await Promise.allSettled([
        window.velopackApi.getVersion(),
        window.velopackApi.getChannel(),
        window.velopackApi.getAvailableChannels(),
        window.updateAPI.isSupported()
      ]);

      const [versionResult, channelResult, channelsResult, supportedResult] = results;

      if (supportedResult.status === 'fulfilled') {
        setUpdatesSupported(supportedResult.value);
      } else {
        console.error('Failed to check if updates are supported:', supportedResult.reason);
      }

      if (versionResult.status === 'fulfilled') {
        setCurrentVersion(versionResult.value);
        setVersionError(false);
      } else {
        console.error('Failed to get version:', versionResult.reason);
        setVersionError(true);
      }

      if (channelResult.status === 'fulfilled') {
        setCurrentChannel(channelResult.value);
        setChannelError(false);
      } else {
        console.error('Failed to get channel:', channelResult.reason);
        setChannelError(true);
      }

      if (channelsResult.status === 'fulfilled') {
        const channels = channelsResult.value;
        setAvailableChannels(channels);
        setChannelsError(false);

        // Load logical display names for each channel
        const displayNames = new Map<string, string>();
        await Promise.all(
          channels.map(async (channel) => {
            try {
              const logicalName = await window.velopackApi.getLogicalChannelName(channel);
              displayNames.set(channel, logicalName);
            } catch (err) {
              console.error(`Failed to get logical name for channel ${channel}:`, err);
              displayNames.set(channel, channel);
            }
          })
        );
        setChannelDisplayNames(displayNames);
      } else {
        console.error('Failed to get available channels:', channelsResult.reason);
        setChannelsError(true);
      }
    } catch (err) {
      console.error('Failed to load update info:', err);
    }
  };

  const handleChannelChange = async (newChannel: string) => {
    try {
      await window.velopackApi.setChannel(newChannel);
      setCurrentChannel(newChannel);
    } catch (err) {
      console.error('Failed to change channel:', err);
      alert('Failed to change update channel');
    }
  };

  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true);
    try {
      await window.updateAPI.checkForUpdates();
    } catch (err) {
      console.error('Failed to check for updates:', err);
    } finally {
      setCheckingForUpdates(false);
    }
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Appearance Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Choose your preferred theme
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all",
                      theme === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Directory Section */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Workspace Directory</h2>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This is where Griptape Nodes will store your workflows and data.
            <br />Changing the workspace directory will trigger an engine restart.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={loadingWorkspace ? '' : workspaceDir}
              readOnly
              className={cn(
                "flex-1 px-3 py-2 text-sm rounded-md",
                "bg-background border border-input",
                "font-mono"
              )}
              placeholder={loadingWorkspace ? "Loading workspace directory..." : "No workspace directory set"}
            />
            <button
              onClick={handleSelectWorkspace}
              disabled={updatingWorkspace}
              className={cn(
                "px-4 py-2 text-sm rounded-md",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
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
                  "flex-1 px-3 py-2 text-sm rounded-md",
                  "bg-background border border-input",
                  "font-mono"
                )}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className={cn(
                  "px-4 py-2 text-sm rounded-md",
                  "bg-secondary text-secondary-foreground",
                  "hover:bg-secondary/80 transition-colors"
                )}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={copyApiKey}
                className={cn(
                  "px-4 py-2 text-sm rounded-md",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors"
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

      {/* Environment Information */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">Environment Information</h2>

        {loading ? (
          <p className="text-muted-foreground">Loading environment information...</p>
        ) : error ? (
          <div className="text-destructive">{error}</div>
        ) : environmentInfo ? (
          <div className="space-y-6">
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
                  <span className={cn(
                    "font-medium",
                    environmentInfo.griptapeNodes.installed ? "text-green-600" : "text-yellow-600"
                  )}>
                    {environmentInfo.griptapeNodes.installed ? 'Installed' : 'Not Installed'}
                  </span>
                </p>
                {environmentInfo.griptapeNodes.installed && (
                  <>
                    <p className="text-sm">
                      <span className="font-medium">Version:</span> {environmentInfo.griptapeNodes.version}
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
                  <span className="font-medium">Node Version:</span> {environmentInfo.system.nodeVersion}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Electron Version:</span> {environmentInfo.system.electronVersion}
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
                      <li key={index} className="text-yellow-600">• {error}</li>
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
              <p className={cn(
                "text-sm",
                versionError ? "text-destructive" : "text-muted-foreground"
              )}>
                {versionError ? 'Failed to load version' : (currentVersion || 'Loading...')}
              </p>
            </div>
            <button
              onClick={handleCheckForUpdates}
              disabled={!updatesSupported || checkingForUpdates}
              className={cn(
                "px-4 py-2 text-sm rounded-md",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {checkingForUpdates ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Release Channel</p>
            {channelsError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-2">
                <p className="text-xs text-destructive">
                  Failed to load available channels
                </p>
              </div>
            )}
            <select
              value={currentChannel}
              onChange={(e) => handleChannelChange(e.target.value)}
              disabled={!updatesSupported || channelError || channelsError}
              className={cn(
                "w-full px-3 py-2 text-sm rounded-md",
                "bg-background border",
                channelError || channelsError ? "border-destructive" : "border-input",
                "focus:outline-none focus:ring-2 focus:ring-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {availableChannels.length > 0 ? (
                availableChannels.map((channel) => {
                  const displayName = channelDisplayNames.get(channel) || channel;
                  const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
                  return (
                    <option key={channel} value={channel}>
                      {formattedName}
                    </option>
                  );
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
    </div>
  );
};

export default Settings;
