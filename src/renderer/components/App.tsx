import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import LoginPage from './LoginPage'
import MainApp from './MainApp'
import OnboardingWizard from './onboarding/OnboardingWizard'

const AppContent: React.FC = () => {
  const isElectron = typeof window.electronAPI !== 'undefined'

  const { isAuthenticated } = useAuth()
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
