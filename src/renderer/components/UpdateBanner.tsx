import React, { useState, useEffect } from 'react'
import { X, Download, RotateCcw, Settings, AlertCircle } from 'lucide-react'
import { cn } from '../utils/utils'

interface UpdateBannerProps {
  version: string
  isReadyToInstall: boolean
  updateInfo: any
  onDismiss: () => void
  onNavigateToSettings?: () => void
  externalError?: string | null
  onClearExternalError?: () => void
  isDownloading?: boolean
  downloadProgress?: number
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({
  version,
  isReadyToInstall,
  updateInfo,
  onDismiss,
  onNavigateToSettings,
  externalError,
  onClearExternalError,
  isDownloading = false,
  downloadProgress = 0
}) => {
  const [isApplying, setIsApplying] = useState(false)
  const [shouldApplyAfterDownload, setShouldApplyAfterDownload] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)

  // Combine internal error with external error (from auto-downloads)
  const downloadError = internalError || externalError || null

  // Handle download completion for "Download & Restart" flow
  useEffect(() => {
    if (!shouldApplyAfterDownload) return
    if (isDownloading) return // Still downloading
    if (downloadError) {
      // Download failed, reset the flag
      setShouldApplyAfterDownload(false)
      return
    }

    // Download completed and we should apply
    if (isReadyToInstall) {
      setShouldApplyAfterDownload(false)
      setIsApplying(true)
      window.velopackApi.applyUpdates(updateInfo).catch((err) => {
        console.error('Failed to apply update:', err)
        setIsApplying(false)
      })
    }
  }, [shouldApplyAfterDownload, isDownloading, isReadyToInstall, downloadError, updateInfo])

  const handleRestartNow = async () => {
    setIsApplying(true)
    try {
      await window.velopackApi.applyUpdates(updateInfo)
    } catch (err) {
      console.error('Failed to apply update:', err)
      setIsApplying(false)
    }
  }

  const handleDownload = async () => {
    setShouldApplyAfterDownload(false)
    setInternalError(null)
    onClearExternalError?.()
    try {
      await window.velopackApi.downloadUpdates(updateInfo)
      // Download state is tracked by the hook via IPC events
    } catch (err) {
      console.error('Failed to download update:', err)
      setInternalError('App update download failed.')
    }
  }

  const handleDownloadAndRestart = async () => {
    setShouldApplyAfterDownload(true)
    setInternalError(null)
    onClearExternalError?.()
    try {
      await window.velopackApi.downloadUpdates(updateInfo)
      // Download state is tracked by the hook via IPC events
      // The useEffect will apply updates when download completes
    } catch (err) {
      console.error('Failed to download update:', err)
      setShouldApplyAfterDownload(false)
      setInternalError('App update download failed.')
    }
  }

  const handleRetry = () => {
    setInternalError(null)
    onClearExternalError?.()
  }

  const isDisabled = isDownloading || isApplying

  // Error state uses red styling
  const hasError = !!downloadError

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 pr-4',
        'pl-24', // Left padding to avoid window control buttons
        hasError
          ? 'bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800'
          : 'bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800'
      )}
    >
      <div className="flex items-center gap-2">
        {downloadError ? (
          // Error state - show error message
          <>
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">{downloadError}</span>
          </>
        ) : isDownloading ? (
          // Downloading state - show progress
          <>
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Downloading App v{version}... {Math.round(downloadProgress)}%
            </span>
            <div className="w-32 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </>
        ) : isReadyToInstall ? (
          <>
            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              App update v{version} is ready to install.
            </span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              A new app version (v{version}) is available.
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {downloadError ? (
          // Error state - show Retry button
          <button
            onClick={handleRetry}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md',
              'bg-red-600 text-white',
              'hover:bg-red-700 transition-colors'
            )}
          >
            Retry
          </button>
        ) : isDownloading ? null : isReadyToInstall ? ( // While downloading, no action buttons needed (progress is shown in left section)
          // Update is downloaded and ready to install - just show Restart Now
          <button
            onClick={handleRestartNow}
            disabled={isDisabled}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md',
              'bg-blue-600 text-white',
              'hover:bg-blue-700 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isApplying ? 'Restarting...' : 'Restart Now'}
          </button>
        ) : (
          // Update available but not downloaded yet - show Download and Download & Restart
          <>
            <button
              onClick={handleDownload}
              disabled={isDisabled}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md',
                'border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400',
                'hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Download
            </button>
            <button
              onClick={handleDownloadAndRestart}
              disabled={isDisabled}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md',
                'bg-blue-600 text-white',
                'hover:bg-blue-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Download & Restart
            </button>
            {/* Link to manage update settings */}
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 text-xs',
                  'text-blue-600 dark:text-blue-400',
                  'hover:underline transition-colors'
                )}
              >
                <Settings className="w-3 h-3" />
                Manage
              </button>
            )}
          </>
        )}

        <button
          onClick={onDismiss}
          disabled={isDisabled}
          className={cn(
            'p-1 rounded-md',
            'transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            hasError
              ? 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/50'
              : 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50'
          )}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
