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
        <div className={`flex items-center ${isMac ? 'ml-20' : ''}`}>
          <img 
            src="/griptape_nodes_header_logo.svg" 
            className="h-8 non-draggable"
            alt="Griptape"
          />
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