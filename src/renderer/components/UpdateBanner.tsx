import React, { useState } from 'react'
import { X, Download, RotateCcw } from 'lucide-react'
import { cn } from '../utils/utils'

interface UpdateBannerProps {
  version: string
  isReadyToInstall: boolean
  updateInfo: any
  onDismiss: () => void
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({
  version,
  isReadyToInstall,
  updateInfo,
  onDismiss
}) => {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  const handleRestartNow = async () => {
    setIsApplying(true)
    try {
      await window.velopackApi.applyUpdates(updateInfo)
    } catch (err) {
      console.error('Failed to apply update:', err)
      setIsApplying(false)
    }
  }

  const handleDownloadAndInstall = async (enableAutoUpdates: boolean = false) => {
    setIsDownloading(true)
    try {
      // Optionally enable auto-updates before installing
      if (enableAutoUpdates) {
        await window.settingsAPI.setAutoDownloadUpdates(true)
      }

      await window.velopackApi.downloadUpdates(updateInfo)
      setIsDownloading(false)
      setIsApplying(true)
      await window.velopackApi.applyUpdates(updateInfo)
    } catch (err) {
      console.error('Failed to download/apply update:', err)
      setIsDownloading(false)
      setIsApplying(false)
    }
  }

  const handleRestartAndEnableAutoUpdates = async () => {
    setIsApplying(true)
    try {
      await window.settingsAPI.setAutoDownloadUpdates(true)
      await window.velopackApi.applyUpdates(updateInfo)
    } catch (err) {
      console.error('Failed to apply update:', err)
      setIsApplying(false)
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
        {isReadyToInstall ? (
          <>
            <RotateCcw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Update v{version} downloaded and ready to install.
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
        {isReadyToInstall ? (
          <>
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
            <button
              onClick={handleRestartAndEnableAutoUpdates}
              disabled={isDisabled}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md',
                'bg-green-600 text-white',
                'hover:bg-green-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Restart & Enable Auto-Updates
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleDownloadAndInstall(false)}
              disabled={isDisabled}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md',
                'bg-blue-600 text-white',
                'hover:bg-blue-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isDownloading ? 'Downloading...' : isApplying ? 'Installing...' : 'Install Update'}
            </button>
            <button
              onClick={() => handleDownloadAndInstall(true)}
              disabled={isDisabled}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md',
                'bg-green-600 text-white',
                'hover:bg-green-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Install & Enable Auto-Updates
            </button>
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
