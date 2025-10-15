import React, { useState } from 'react'
import { EngineProvider } from '../contexts/EngineContext'
import Dashboard from '../pages/Dashboard'
import Engine from '../pages/Engine'
import Editor from '../pages/Editor'
import Settings from '../pages/Settings'
import { Header } from './Header'
import { EditorWebview } from './EditorWebview'
import UpdateProgressNotification from './UpdateProgressNotification'

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard')

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onPageChange={setCurrentPage} />
      case 'engine':
        return <Engine />
      case 'editor':
        return <Editor />
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
        <Header selectedPage={currentPage} onPageChange={setCurrentPage} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">{renderContent()}</main>

        {/* Persistent Editor Webview - portalled to document.body, overlays when active */}
        <EditorWebview isVisible={currentPage === 'editor'} />

        {/* Update Progress Notification */}
        <UpdateProgressNotification />
      </div>
    </EngineProvider>
  )
}

export default MainApp
