import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import Dashboard from '../pages/Dashboard';
import Engine from '../pages/Engine';
import Settings from '../pages/Settings';

const MainApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'engine':
        return <Engine />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Bar with logo - draggable */}
      <header className="bg-card border-b border-border px-6 py-3 flex items-center draggable">
        <div className={`flex items-center gap-3 ${isMac ? 'ml-16' : ''}`}>
          <img 
            src="/griptape_nodes_mark_light.svg" 
            className="hidden w-6 h-6 dark:block non-draggable"
            alt="Griptape Nodes Logo"
          />
          <img 
            src="/griptape_nodes_mark_dark.svg" 
            className="block w-6 h-6 dark:hidden non-draggable"
            alt="Griptape Nodes Logo"
          />
          <span className="font-semibold text-lg non-draggable">Griptape Nodes</span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar selectedPage={currentPage} onPageChange={setCurrentPage} hideHeader={true} />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default MainApp;