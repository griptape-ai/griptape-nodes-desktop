import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import LoginPage from './LoginPage'
import MainApp from './MainApp'
import OnboardingWizard from './onboarding/OnboardingWizard'
import headerLogoSrc from '../../assets/griptape_nodes_header_logo.svg'

const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center draggable">
      <div className="w-screen h-screen flex flex-col bg-gray-900 items-center justify-center">
        <img src={headerLogoSrc} alt="Griptape" className="h-16 mb-8" />
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading...</span>
        </div>
      </div>
    </div>
  )
}

const AppContent: React.FC = () => {
  const isElectron = typeof window.electronAPI !== 'undefined'

  const { isAuthenticated, isLoading } = useAuth()
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(true)

  // Reset wizard state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setShowOnboardingWizard(true)
    }
  }, [isAuthenticated])

  if (!isElectron) {
    return <p>NOT ELECTRON :p</p>
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (showOnboardingWizard) {
    return <OnboardingWizard onOnboardingComplete={() => setShowOnboardingWizard(false)} />
  }

  return <MainApp />
}

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
