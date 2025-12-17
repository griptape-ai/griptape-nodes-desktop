import React, { useState, useEffect } from 'react'
import { X, Download, RotateCcw, Settings } from 'lucide-react'
import { cn } from '../utils/utils'

interface UpdateBannerProps {
  version: string
  isReadyToInstall: boolean
  updateInfo: any
  onDismiss: () => void
  updateBehavior: 'auto-update' | 'prompt' | 'silence'
  onDownloadComplete?: () => void
  onNavigateToSettings?: () => void
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({
  version,
  isReadyToInstall,
  updateInfo,
  onDismiss,
  updateBehavior,
  onDownloadComplete,
  onNavigateToSettings
}) => {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isApplying, setIsApplying] = useState(false)
  const [shouldApplyAfterDownload, setShouldApplyAfterDownload] = useState(false)

  // Listen for download progress events
  useEffect(() => {
    if (!isDownloading) return

    const handleProgress = (_event: any, progress: number) => {
      setDownloadProgress(progress)
    }

    const handleComplete = async () => {
      setIsDownloading(false)
      setDownloadProgress(100)

      // If user clicked "Download & Restart", apply the update now
      if (shouldApplyAfterDownload) {
        setShouldApplyAfterDownload(false)
        setIsApplying(true)
        try {
          await window.velopackApi.applyUpdates(updateInfo)
        } catch (err) {
          console.error('Failed to apply update:', err)
          setIsApplying(false)
        }
      } else {
        onDownloadComplete?.()
      }
    }

    window.updateAPI.onDownloadProgress(handleProgress)
    window.updateAPI.onDownloadComplete(handleComplete)

    return () => {
      window.updateAPI.removeDownloadProgress(handleProgress)
      window.updateAPI.removeDownloadComplete(handleComplete)
    }
  }, [isDownloading, onDownloadComplete, shouldApplyAfterDownload, updateInfo])

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
    setIsDownloading(true)
    setDownloadProgress(0)
    setShouldApplyAfterDownload(false)
    try {
      await window.velopackApi.downloadUpdates(updateInfo)
      // Note: completion is handled by the useEffect listener above
    } catch (err) {
      console.error('Failed to download update:', err)
      setIsDownloading(false)
    }
  }

  const handleDownloadAndRestart = async () => {
    setIsDownloading(true)
    setDownloadProgress(0)
    setShouldApplyAfterDownload(true)
    try {
      await window.velopackApi.downloadUpdates(updateInfo)
      // Note: completion and apply is handled by the useEffect listener above
    } catch (err) {
      console.error('Failed to download update:', err)
      setIsDownloading(false)
      setShouldApplyAfterDownload(false)
    }
  }

  const isDisabled = isDownloading || isApplying

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 pr-4',
        'pl-24', // Left padding to avoid window control buttons
        'bg-blue-50 dark:bg-blue-900/20',
        'border-b border-blue-200 dark:border-blue-800'
      )}
    >
      <div className="flex items-center gap-2">
        {isDownloading ? (
          // Downloading state - show progress
          <>
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Downloading v{version}... {Math.round(downloadProgress)}%
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
              Update v{version} is ready to install.
            </span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              A new version (v{version}) is available.
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isDownloading ? (
          // While downloading, no action buttons needed (progress is shown in left section)
          null
        ) : isReadyToInstall ? (
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
                Manage Updates
              </button>
            )}
          </>
        )}

        <button
          onClick={onDismiss}
          disabled={isDisabled}
          className={cn(
            'p-1 rounded-md',
            'text-blue-600 dark:text-blue-400',
            'hover:bg-blue-100 dark:hover:bg-blue-800/50',
            'transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
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
