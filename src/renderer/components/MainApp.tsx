import React, { useState } from 'react'
import { EngineProvider } from '../contexts/EngineContext'
import Dashboard from '../pages/Dashboard'
import Engine from '../pages/Engine'
import Editor from '../pages/Editor'
import Settings from '../pages/Settings'
import { Sidebar } from './Sidebar'
import { EditorWebview } from './EditorWebview'
import UpdateProgressNotification from './UpdateProgressNotification'
import headerLogoSrc from '../../assets/griptape_nodes_header_logo.svg'

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

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
        {/* Top Bar with logo - draggable */}
        <header className="bg-card border-b border-border px-6 py-3 flex items-center draggable">
          <div className={`flex items-center ${isMac ? 'ml-20' : ''}`}>
            <img src={headerLogoSrc} className="h-8 non-draggable" alt="Griptape" />
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar selectedPage={currentPage} onPageChange={setCurrentPage} hideHeader={true} />

          {/* Content Area */}
          <main className="flex-1 overflow-y-auto p-6">{renderContent()}</main>
        </div>

        {/* Persistent Editor Webview - portalled to document.body, overlays when active */}
        <EditorWebview isVisible={currentPage === 'editor'} />

        {/* Update Progress Notification */}
        <UpdateProgressNotification />
      </div>
    </EngineProvider>
  )
}

export default MainApp
