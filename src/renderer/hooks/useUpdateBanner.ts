import { useState, useEffect, useCallback } from 'react'

interface UpdateBannerState {
  updateInfo: any
  isUpdateReadyToInstall: boolean
  updateVersion: string | undefined
  shouldShowUpdateBanner: boolean
  handleDismissUpdate: () => Promise<void>
}

/**
 * Custom hook for managing update banner state.
 * Consolidates logic shared between MainApp and LoginPage.
 */
export function useUpdateBanner(): UpdateBannerState {
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [isUpdateReadyToInstall, setIsUpdateReadyToInstall] = useState(false)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  // Load dismissed update version on mount
  useEffect(() => {
    const loadDismissedVersion = async () => {
      try {
        const version = await window.settingsAPI.getDismissedUpdateVersion()
        setDismissedVersion(version)
      } catch (err) {
        console.error('Failed to load dismissed update version:', err)
      }
    }
    loadDismissedVersion()
  }, [])

  // Listen for update events from main process
  useEffect(() => {
    const handleUpdateAvailable = (_event: any, info: any) => {
      setUpdateInfo(info)
      setIsUpdateReadyToInstall(false)
    }

    const handleUpdateReadyToInstall = (_event: any, info: any) => {
      setUpdateInfo(info)
      setIsUpdateReadyToInstall(true)
    }

    window.updateAPI.onUpdateAvailable(handleUpdateAvailable)
    window.updateAPI.onUpdateReadyToInstall(handleUpdateReadyToInstall)

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

  const updateVersion = updateInfo?.TargetFullRelease?.Version
  const shouldShowUpdateBanner = updateInfo && updateVersion && updateVersion !== dismissedVersion

  return {
    updateInfo,
    isUpdateReadyToInstall,
    updateVersion,
    shouldShowUpdateBanner,
    handleDismissUpdate
  }
}
