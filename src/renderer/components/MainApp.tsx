import React, { useState, useEffect } from 'react'
import { EngineProvider } from '../contexts/EngineContext'
import Dashboard from '../pages/Dashboard'
import Engine from '../pages/Engine'
import Settings from '../pages/Settings'
import { Header } from './Header'
import { EditorWebview } from './EditorWebview'
import UpdateProgressNotification from './UpdateProgressNotification'

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [showSystemMonitor, setShowSystemMonitor] = useState(false)

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
    const handleToggle = (event: CustomEvent) => {
      setShowSystemMonitor(event.detail)
    }

    window.addEventListener('system-monitor-toggle', handleToggle as EventListener)

    return () => {
      window.removeEventListener('system-monitor-toggle', handleToggle as EventListener)
    }
  }, [])

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onPageChange={setCurrentPage} />
      case 'engine':
        return <Engine />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard onPageChange={setCurrentPage} />
    }
  }

  return (
    <EngineProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header with navigation */}
        <Header
          selectedPage={currentPage}
          onPageChange={setCurrentPage}
          showSystemMonitor={showSystemMonitor}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          {/* Normal page content - hidden when editor is active */}
          {currentPage !== 'editor' && renderContent()}

          {/* Persistent EditorWebview - always mounted, visibility controlled */}
          <EditorWebview isVisible={currentPage === 'editor'} />
        </main>

        {/* Update Progress Notification */}
        <UpdateProgressNotification />
      </div>
    </EngineProvider>
  )
}

export default MainApp
