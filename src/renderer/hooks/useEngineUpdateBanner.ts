import { useState, useEffect, useCallback } from 'react'
import type { IpcEvent } from '@/types/global'

interface EngineUpdateInfo {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
}

interface EngineUpdateBannerState {
  updateInfo: EngineUpdateInfo | null
  isUpdating: boolean
  updateError: string | null
  shouldShowBanner: boolean
  handleDismiss: () => Promise<void>
  handleUpdate: () => Promise<void>
  clearError: () => void
}

/**
 * Custom hook for managing engine update banner state.
 * Similar pattern to useUpdateBanner but for GTN engine updates.
 */
export function useEngineUpdateBanner(): EngineUpdateBannerState {
  const [updateInfo, setUpdateInfo] = useState<EngineUpdateInfo | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Load dismissed engine update version on mount
  useEffect(() => {
    const loadDismissedVersion = async () => {
      try {
        const version = await window.settingsAPI.getDismissedEngineUpdateVersion()
        setDismissedVersion(version)
      } catch (err) {
        console.error('Failed to load dismissed engine update version:', err)
      }
    }
    loadDismissedVersion()
  }, [])

  // Listen for engine update events from main process
  useEffect(() => {
    const handleUpdateAvailable = (_event: IpcEvent, info: EngineUpdateInfo) => {
      setUpdateInfo(info)
      setUpdateError(null)
    }

    const handleUpdateStarted = () => {
      setIsUpdating(true)
      setUpdateError(null)
    }

    const handleUpdateComplete = () => {
      setIsUpdating(false)
      setUpdateInfo(null)
      setUpdateError(null)
    }

    const handleUpdateFailed = (_event: IpcEvent, error: string) => {
      setIsUpdating(false)
      setUpdateError(error || 'Engine update failed')
    }

    window.engineUpdateAPI.onUpdateAvailable(handleUpdateAvailable)
    window.engineUpdateAPI.onUpdateStarted(handleUpdateStarted)
    window.engineUpdateAPI.onUpdateComplete(handleUpdateComplete)
    window.engineUpdateAPI.onUpdateFailed(handleUpdateFailed)

    // Check for any pending update info that was set before we mounted
    const checkPendingUpdate = async () => {
      try {
        const pending = await window.engineUpdateAPI.getPendingUpdate()
        if (pending && pending.updateAvailable) {
          setUpdateInfo(pending)
        }
      } catch (err) {
        console.error('Failed to check pending engine update:', err)
      }
    }
    checkPendingUpdate()

    return () => {
      window.engineUpdateAPI.removeUpdateAvailable(handleUpdateAvailable)
      window.engineUpdateAPI.removeUpdateStarted(handleUpdateStarted)
      window.engineUpdateAPI.removeUpdateComplete(handleUpdateComplete)
      window.engineUpdateAPI.removeUpdateFailed(handleUpdateFailed)
    }
  }, [])

  const handleDismiss = useCallback(async () => {
    if (updateInfo?.latestVersion) {
      try {
        await window.settingsAPI.setDismissedEngineUpdateVersion(updateInfo.latestVersion)
        setDismissedVersion(updateInfo.latestVersion)
      } catch (err) {
        console.error('Failed to save dismissed engine update version:', err)
      }
    }
    setUpdateInfo(null)
    setUpdateError(null)
  }, [updateInfo])

  const handleUpdate = useCallback(async () => {
    try {
      setUpdateError(null)
      await window.engineUpdateAPI.performUpdate()
      // State updates will be handled by the event listeners
    } catch (err) {
      console.error('Failed to perform engine update:', err)
      setUpdateError('Failed to start engine update')
    }
  }, [])

  const clearError = useCallback(() => {
    setUpdateError(null)
  }, [])

  // Determine if banner should be shown
  const shouldShowBanner =
    (updateInfo?.updateAvailable &&
      updateInfo.latestVersion &&
      updateInfo.latestVersion !== dismissedVersion) ||
    isUpdating ||
    !!updateError

  return {
    updateInfo,
    isUpdating,
    updateError,
    shouldShowBanner,
    handleDismiss,
    handleUpdate,
    clearError
  }
}
