import { useState, useEffect, useCallback } from 'react'
import type { IpcEvent, UpdateInfo } from '@/types/global'

interface UpdateBannerState {
  updateInfo: any
  isUpdateReadyToInstall: boolean
  updateVersion: string | undefined
  currentVersion: string | undefined
  shouldShowUpdateBanner: boolean
  downloadError: string | null
  isDownloading: boolean
  downloadProgress: number
  handleDismissUpdate: () => Promise<void>
  clearDownloadError: () => void
}

/**
 * Custom hook for managing update banner state.
 * Consolidates logic shared between MainApp and LoginPage.
 */
export function useUpdateBanner(): UpdateBannerState {
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [isUpdateReadyToInstall, setIsUpdateReadyToInstall] = useState(false)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [currentVersion, setCurrentVersion] = useState<string | undefined>(undefined)

  // Load dismissed update version and current version on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [dismissed, current] = await Promise.all([
          window.settingsAPI.getDismissedUpdateVersion(),
          window.velopackApi.getVersion(),
        ])
        setDismissedVersion(dismissed)
        setCurrentVersion(current)
      } catch (err) {
        console.error('Failed to load update banner initial data:', err)
      }
    }
    loadInitialData()
  }, [])

  // Listen for update events from main process
  useEffect(() => {
    const handleUpdateAvailable = (_event: IpcEvent, info: UpdateInfo) => {
      setUpdateInfo(info)
      setIsUpdateReadyToInstall(false)
      setDownloadError(null)
    }

    const handleUpdateReadyToInstall = (_event: IpcEvent, info: UpdateInfo) => {
      setUpdateInfo(info)
      setIsUpdateReadyToInstall(true)
      setIsDownloading(false)
      setDownloadError(null)
    }

    const handleDownloadFailed = (_event: IpcEvent, info: UpdateInfo, _errorMessage: string) => {
      setUpdateInfo(info)
      setIsUpdateReadyToInstall(false)
      setIsDownloading(false)
      setDownloadError('App update download failed.')
    }

    const handleDownloadStarted = (_event: IpcEvent, info: UpdateInfo) => {
      setUpdateInfo(info)
      setIsDownloading(true)
      setDownloadProgress(0)
      setDownloadError(null)
    }

    const handleDownloadProgress = (_event: IpcEvent, progress: number) => {
      setDownloadProgress(progress)
    }

    const handleDownloadComplete = () => {
      setIsDownloading(false)
      setDownloadProgress(100)
    }

    window.updateAPI.onUpdateAvailable(handleUpdateAvailable)
    window.updateAPI.onUpdateReadyToInstall(handleUpdateReadyToInstall)
    window.updateAPI.onDownloadFailed(handleDownloadFailed)
    window.updateAPI.onDownloadStarted(handleDownloadStarted)
    window.updateAPI.onDownloadProgress(handleDownloadProgress)
    window.updateAPI.onDownloadComplete(handleDownloadComplete)

    // Check for any pending update info that was set before we mounted
    const checkPendingUpdate = async () => {
      try {
        const pending = await window.updateAPI.getPendingUpdate()
        if (pending) {
          setUpdateInfo(pending.info)
          setIsUpdateReadyToInstall(pending.isReadyToInstall)
        }
      } catch (err) {
        console.error('Failed to check pending update:', err)
      }
    }
    checkPendingUpdate()

    return () => {
      window.updateAPI.removeUpdateAvailable(handleUpdateAvailable)
      window.updateAPI.removeUpdateReadyToInstall(handleUpdateReadyToInstall)
      window.updateAPI.removeDownloadFailed(handleDownloadFailed)
      window.updateAPI.removeDownloadStarted(handleDownloadStarted)
      window.updateAPI.removeDownloadProgress(handleDownloadProgress)
      window.updateAPI.removeDownloadComplete(handleDownloadComplete)
    }
  }, [])

  const handleDismissUpdate = useCallback(async () => {
    if (updateInfo?.TargetFullRelease?.Version) {
      const version = updateInfo.TargetFullRelease.Version
      try {
        await window.settingsAPI.setDismissedUpdateVersion(version)
        setDismissedVersion(version)
      } catch (err) {
        console.error('Failed to save dismissed update version:', err)
      }
    }
    setUpdateInfo(null)
  }, [updateInfo])

  // Clear download error (e.g., when user clicks Retry)
  const clearDownloadError = useCallback(() => {
    setDownloadError(null)
  }, [])

  const updateVersion = updateInfo?.TargetFullRelease?.Version
  const shouldShowUpdateBanner =
    (updateInfo && updateVersion && updateVersion !== dismissedVersion) || isDownloading

  return {
    updateInfo,
    isUpdateReadyToInstall,
    updateVersion,
    currentVersion,
    shouldShowUpdateBanner,
    downloadError,
    isDownloading,
    downloadProgress,
    handleDismissUpdate,
    clearDownloadError,
  }
}
