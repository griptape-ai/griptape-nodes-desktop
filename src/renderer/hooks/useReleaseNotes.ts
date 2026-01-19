import { useState, useEffect, useCallback } from 'react'
import type { IpcEvent, ReleaseNotesInfo } from '@/types/global'

interface ReleaseNotesState {
  releaseNotes: ReleaseNotesInfo | null
  isVisible: boolean
  handleDismiss: () => Promise<void>
}

/**
 * Custom hook for managing release notes modal state.
 * Shows release notes when the app has been updated to a new version.
 *
 * @param isAuthenticated - Only show modal when user is authenticated (to avoid interrupting login)
 */
export function useReleaseNotes(isAuthenticated: boolean): ReleaseNotesState {
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesInfo | null>(null)
  const [shouldShow, setShouldShow] = useState(false)

  // Check for pending release notes on mount and listen for events
  useEffect(() => {
    const handleAvailable = (_event: IpcEvent, info: ReleaseNotesInfo) => {
      setReleaseNotes(info)
      setShouldShow(true)
    }

    window.releaseNotesAPI.onAvailable(handleAvailable)

    // Check for any pending release notes that were set before we mounted
    const checkPending = async () => {
      try {
        const pending = await window.releaseNotesAPI.getPending()
        if (pending) {
          setReleaseNotes(pending)
          setShouldShow(true)
        }
      } catch (err) {
        console.error('Failed to check pending release notes:', err)
      }
    }
    checkPending()

    return () => {
      window.releaseNotesAPI.removeAvailable(handleAvailable)
    }
  }, [])

  const handleDismiss = useCallback(async () => {
    try {
      await window.releaseNotesAPI.dismiss()
    } catch (err) {
      console.error('Failed to dismiss release notes:', err)
    }
    setReleaseNotes(null)
    setShouldShow(false)
  }, [])

  // Only show when authenticated and we have release notes
  const isVisible = isAuthenticated && shouldShow && releaseNotes !== null

  return {
    releaseNotes,
    isVisible,
    handleDismiss
  }
}
