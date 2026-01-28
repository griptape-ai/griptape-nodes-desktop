import React, { useState, useEffect } from 'react'
import { Download, RotateCcw, AlertCircle } from 'lucide-react'
import { cn } from '../utils/utils'
import { BaseBanner, BannerButton, getIconColorClass, getTextColorClass } from './BaseBanner'

interface UpdateBannerProps {
  version: string
  currentVersion?: string
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
  currentVersion,
  isReadyToInstall,
  updateInfo,
  onDismiss,
  onNavigateToSettings,
  externalError,
  onClearExternalError,
  isDownloading = false,
  downloadProgress = 0,
}) => {
  const [isApplying, setIsApplying] = useState(false)
  const [shouldApplyAfterDownload, setShouldApplyAfterDownload] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)

  // Combine internal error with external error (from auto-downloads)
  const downloadError = internalError || externalError || null
  const hasError = !!downloadError
  const isDisabled = isDownloading || isApplying
  const colorScheme = 'blue'

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

  const iconClass = getIconColorClass(colorScheme, hasError)
  const textClass = getTextColorClass(colorScheme, hasError)

  const renderContent = () => {
    if (downloadError) {
      return (
        <>
          <AlertCircle className={cn('w-4 h-4', iconClass)} />
          <span className={cn('text-sm', textClass)}>{downloadError}</span>
        </>
      )
    }

    if (isDownloading) {
      return (
        <>
          <Download className={cn('w-4 h-4 animate-pulse', iconClass)} />
          <span className={cn('text-sm', textClass)}>
            Downloading App v{version}... {Math.round(downloadProgress)}%
          </span>
          <div className="w-32 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </>
      )
    }

    if (isReadyToInstall) {
      return (
        <>
          <RotateCcw className={cn('w-4 h-4', iconClass)} />
          <span className={cn('text-sm', textClass)}>
            App update v{version} is ready to install.
          </span>
        </>
      )
    }

    return (
      <>
        <Download className={cn('w-4 h-4', iconClass)} />
        <span className={cn('text-sm', textClass)}>
          A new app version (v{version}) is available.
          {currentVersion ? ` Current version: v${currentVersion}` : ''}
        </span>
      </>
    )
  }

  const renderActions = () => {
    if (downloadError) {
      return (
        <BannerButton onClick={handleRetry} variant="primary" colorScheme="red">
          Retry
        </BannerButton>
      )
    }

    if (isDownloading) {
      return null
    }

    if (isReadyToInstall) {
      return (
        <BannerButton
          onClick={handleRestartNow}
          disabled={isDisabled}
          variant="primary"
          colorScheme={colorScheme}
        >
          {isApplying ? 'Restarting...' : 'Restart Now'}
        </BannerButton>
      )
    }

    return (
      <>
        <BannerButton
          onClick={handleDownload}
          disabled={isDisabled}
          variant="secondary"
          colorScheme={colorScheme}
        >
          Download
        </BannerButton>
        <BannerButton
          onClick={handleDownloadAndRestart}
          disabled={isDisabled}
          variant="primary"
          colorScheme={colorScheme}
        >
          Download & Restart
        </BannerButton>
      </>
    )
  }

  return (
    <BaseBanner
      colorScheme={colorScheme}
      hasError={hasError}
      onDismiss={onDismiss}
      onNavigateToSettings={onNavigateToSettings}
      disabled={isDisabled}
      showSettingsLink={!downloadError && !isDownloading && !isReadyToInstall}
      actions={renderActions()}
    >
      {renderContent()}
    </BaseBanner>
  )
}

export default UpdateBanner
