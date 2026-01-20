import React, { useState, useEffect, useCallback } from 'react'
import { EngineProvider } from '../contexts/EngineContext'
import Dashboard from '../pages/Dashboard'
import Engine from '../pages/Engine'
import Settings from '../pages/Settings'
import { Header } from './Header'
import { WindowsTitleBar } from './WindowsTitleBar'
import { EditorWebview } from './EditorWebview'
import UpdateBanner from './UpdateBanner'
import EngineUpdateBanner from './EngineUpdateBanner'
import { ReleaseNotesModal } from './ReleaseNotesModal'
import { TutorialProvider, TutorialOverlay, useTutorial } from './tutorial'
import { useUpdateBanner } from '../hooks/useUpdateBanner'
import { useEngineUpdateBanner } from '../hooks/useEngineUpdateBanner'
import { useReleaseNotes } from '../hooks/useReleaseNotes'

// Component to set up tutorial action handlers (must be inside TutorialProvider)
function TutorialActionSetup({ onPageChange }: { onPageChange: (page: string) => void }) {
  const { setActionHandler } = useTutorial()

  const handleTutorialAction = useCallback(
    (actionId: string) => {
      if (actionId === 'open-editor') {
        onPageChange('editor')
      }
    },
    [onPageChange]
  )

  useEffect(() => {
    setActionHandler(handleTutorialAction)
    return () => setActionHandler(null)
  }, [setActionHandler, handleTutorialAction])

  return null
}

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [showSystemMonitor, setShowSystemMonitor] = useState(false)
  const [platform, setPlatform] = useState<string>('')

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform)
  }, [])

  const isWindows = platform === 'win32'

  // Update banner state from shared hook
  const {
    updateInfo,
    isUpdateReadyToInstall,
    updateVersion,
    currentVersion,
    shouldShowUpdateBanner,
    downloadError,
    isDownloading,
    downloadProgress,
    handleDismissUpdate,
    clearDownloadError
  } = useUpdateBanner()

  // Engine update banner state
  const {
    updateInfo: engineUpdateInfo,
    isUpdating: isEngineUpdating,
    updateError: engineUpdateError,
    shouldShowBanner: shouldShowEngineUpdateBanner,
    handleDismiss: handleDismissEngineUpdate,
    handleUpdate: handleEngineUpdate,
    clearError: clearEngineUpdateError
  } = useEngineUpdateBanner()

  // Release notes modal state (MainApp only renders when authenticated)
  const {
    releaseNotes,
    isVisible: showReleaseNotes,
    handleDismiss: handleDismissReleaseNotes
  } = useReleaseNotes(true)

  // Notify main process when page changes
  useEffect(() => {
    window.electronAPI.setCurrentPage(currentPage)
  }, [currentPage])

  // Load system monitor setting on mount
  useEffect(() => {
    const loadSetting = async () => {
      try {
        const show = await window.settingsAPI.getShowSystemMonitor()
        setShowSystemMonitor(show)
      } catch (err) {
        console.error('Failed to load system monitor setting:', err)
      }
    }

    loadSetting()

    // Listen for setting changes from Settings page
    const handleToggle = (event: Event) => {
      setShowSystemMonitor((event as CustomEvent).detail)
    }

    window.addEventListener('system-monitor-toggle', handleToggle)

    return () => {
      window.removeEventListener('system-monitor-toggle', handleToggle)
    }
  }, [])

  // Listen for navigate to settings from native menu
  useEffect(() => {
    const handleNavigateToSettings = () => {
      setCurrentPage('settings')
    }

    window.electronAPI.onNavigateToSettings(handleNavigateToSettings)

    return () => {
      window.electronAPI.removeNavigateToSettings(handleNavigateToSettings)
    }
  }, [])

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onPageChange={setCurrentPage} />
      case 'engine':
        return <Engine onNavigateToSettings={() => setCurrentPage('settings')} />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard onPageChange={setCurrentPage} />
    }
  }

  return (
    <EngineProvider>
      <TutorialProvider>
        <TutorialActionSetup onPageChange={setCurrentPage} />
        <div className={`flex flex-col h-screen bg-background ${isWindows ? 'pt-9' : ''}`}>
          {/* Windows Custom Title Bar */}
          {isWindows && <WindowsTitleBar />}

          {/* Header with navigation */}
          <Header
            selectedPage={currentPage}
            onPageChange={setCurrentPage}
            showSystemMonitor={showSystemMonitor}
          />

          {/* Update Banner */}
          {(shouldShowUpdateBanner || downloadError) && (
            <UpdateBanner
              version={updateVersion}
              currentVersion={currentVersion}
              isReadyToInstall={isUpdateReadyToInstall}
              updateInfo={updateInfo}
              onDismiss={handleDismissUpdate}
              onNavigateToSettings={() => {
                setCurrentPage('settings')
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('scroll-to-updates'))
                }, 100)
              }}
              externalError={downloadError}
              onClearExternalError={clearDownloadError}
              isDownloading={isDownloading}
              downloadProgress={downloadProgress}
            />
          )}

          {/* Engine Update Banner */}
          {shouldShowEngineUpdateBanner && engineUpdateInfo && (
            <EngineUpdateBanner
              currentVersion={engineUpdateInfo.currentVersion}
              latestVersion={engineUpdateInfo.latestVersion || ''}
              isUpdating={isEngineUpdating}
              error={engineUpdateError}
              onDismiss={handleDismissEngineUpdate}
              onUpdate={handleEngineUpdate}
              onClearError={clearEngineUpdateError}
              onNavigateToSettings={() => {
                setCurrentPage('settings')
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('scroll-to-engine-updates'))
                }, 100)
              }}
            />
          )}

          {/* Release Notes Modal */}
          {showReleaseNotes && releaseNotes && (
            <ReleaseNotesModal
              releaseNotes={releaseNotes}
              onDismiss={handleDismissReleaseNotes}
              onOpenExternal={(url) => window.electronAPI.openExternal(url)}
            />
          )}

          {/* Main Content Area */}
          <main className="flex-1 overflow-hidden">
            {/* Normal page content - hidden when editor is active */}
            {currentPage !== 'editor' && renderContent()}

            {/* Persistent EditorWebview - always mounted, visibility controlled */}
            <EditorWebview isVisible={currentPage === 'editor'} />
          </main>

          {/* Tutorial Overlay */}
          <TutorialOverlay />
        </div>
      </TutorialProvider>
    </EngineProvider>
  )
}

export default MainApp
