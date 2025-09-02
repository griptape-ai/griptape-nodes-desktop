import React from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import LoginPage from './LoginPage';
import MainApp from './MainApp';
import LoadingSpinner from './LoadingSpinner';

const AppContent: React.FC = () => {
  const isElectron = typeof window.electronAPI !== 'undefined';

  const { isLoading, isAuthenticated } = useAuth();

  if (!isElectron) {
    return <p>NOT ELECTRON :p</p>
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <MainApp />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;