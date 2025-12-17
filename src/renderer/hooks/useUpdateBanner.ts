import { useState, useEffect, useCallback } from 'react'

interface UpdateBannerState {
  updateInfo: any
  isUpdateReadyToInstall: boolean
  updateVersion: string | undefined
  shouldShowUpdateBanner: boolean
  updateBehavior: 'auto-update' | 'prompt' | 'silence'
  handleDismissUpdate: () => Promise<void>
  handleDownloadComplete: () => void
}

/**
 * Custom hook for managing update banner state.
 * Consolidates logic shared between MainApp and LoginPage.
 */
export function useUpdateBanner(): UpdateBannerState {
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [isUpdateReadyToInstall, setIsUpdateReadyToInstall] = useState(false)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [updateBehavior, setUpdateBehavior] = useState<'auto-update' | 'prompt' | 'silence'>('prompt')

  // Load dismissed update version and update behavior on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [version, behavior] = await Promise.all([
          window.settingsAPI.getDismissedUpdateVersion(),
          window.settingsAPI.getUpdateBehavior()
        ])
        setDismissedVersion(version)
        setUpdateBehavior(behavior)
      } catch (err) {
        console.error('Failed to load update settings:', err)
      }
    }
    loadSettings()
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

  // Called when download completes in the banner - mark update as ready to install
  const handleDownloadComplete = useCallback(() => {
    setIsUpdateReadyToInstall(true)
    // Also refresh the update behavior in case user enabled auto-updates during download
    window.settingsAPI.getUpdateBehavior().then(setUpdateBehavior).catch(console.error)
  }, [])

  const updateVersion = updateInfo?.TargetFullRelease?.Version
  const shouldShowUpdateBanner = updateInfo && updateVersion && updateVersion !== dismissedVersion

  return {
    updateInfo,
    isUpdateReadyToInstall,
    updateVersion,
    shouldShowUpdateBanner,
    updateBehavior,
    handleDismissUpdate,
    handleDownloadComplete
  }
}
