import React, { useState, useEffect, useCallback } from 'react'
import KeychainExplanation from './KeychainExplanation'
import WorkspaceSetup from './WorkspaceSetup'
import headerLogoSrc from '../../../assets/griptape_nodes_header_logo.svg'

interface OnboardingWizardProps {
  onOnboardingComplete: () => void
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onOnboardingComplete }) => {
  const [currentStep, setCurrentStep] = useState<'keychain' | 'workspace' | null>(null)
  const [showKeychainStep, setShowKeychainStep] = useState(false)
  const [showWorkspaceStep, setShowWorkspaceStep] = useState(false)
  const [isCheckingSteps, setIsCheckingSteps] = useState(true)

  const checkWhichStepsNeeded = useCallback(async () => {
    try {
      const platform = await window.electronAPI.getPlatform()
      const hasExistingStore = await window.oauthAPI.hasExistingEncryptedStore()
      const credentialStorageEnabled = await window.onboardingAPI.isCredentialStorageEnabled()
      const workspaceSetupComplete = await window.onboardingAPI.isWorkspaceSetupComplete()

      // Check if keychain step is needed:
      // - macOS platform
      // - User opted to remember credentials
      // - No encrypted store exists yet (haven't done keychain flow)
      const needsKeychainStep =
        platform === 'darwin' && credentialStorageEnabled && !hasExistingStore

      // For non-macOS platforms, auto-enable credential storage if user opted in
      // Windows uses DPAPI, Linux uses libsecret - both work without prompts
      if (platform !== 'darwin' && credentialStorageEnabled && !hasExistingStore) {
        try {
          const result = await window.onboardingAPI.enableCredentialStorage()
          if (result.success) {
            console.log('Auto-enabled credential storage for non-macOS platform')
          } else {
            // Encryption failed - disable credential storage so user knows they need to re-login
            console.error('Failed to enable credential storage:', result.error)
            await window.onboardingAPI.setCredentialStoragePreference(false)
            console.log('Disabled credential storage preference due to encryption failure')
          }
        } catch (error) {
          console.error('Failed to auto-enable credential storage:', error)
          // Disable the preference so the UI reflects reality
          await window.onboardingAPI.setCredentialStoragePreference(false)
        }
      }

      // Check if workspace step is needed (first time only)
      const needsWorkspaceStep = !workspaceSetupComplete

      setShowKeychainStep(needsKeychainStep)
      setShowWorkspaceStep(needsWorkspaceStep)

      // Determine which step to show first
      if (needsKeychainStep) {
        setCurrentStep('keychain')
      } else if (needsWorkspaceStep) {
        setCurrentStep('workspace')
      } else {
        // No steps needed, complete immediately
        onOnboardingComplete()
      }
    } catch (error) {
      console.error('Failed to check which steps are needed:', error)
      // Default to workspace step if check fails
      setShowWorkspaceStep(true)
      setCurrentStep('workspace')
    } finally {
      setIsCheckingSteps(false)
    }
  }, [onOnboardingComplete])

  useEffect(() => {
    checkWhichStepsNeeded()
  }, [checkWhichStepsNeeded])

  const handleKeychainComplete = () => {
    // Move to workspace step if needed, otherwise complete
    if (showWorkspaceStep) {
      setCurrentStep('workspace')
    } else {
      onOnboardingComplete()
    }
  }

  const handleWorkspaceComplete = async (
    workspaceDirectory: string,
    advancedLibrary: boolean,
    cloudLibrary: boolean
  ) => {
    try {
      // Set the workspace directory preference (GTN will pick it up during initialization)
      if (workspaceDirectory) {
        await window.griptapeAPI.setWorkspacePreference(workspaceDirectory)
      }

      // Set library preferences BEFORE marking setup complete (GTN will pick them up during initialization)
      await window.onboardingAPI.setAdvancedLibraryEnabled(advancedLibrary)
      await window.onboardingAPI.setCloudLibraryEnabled(cloudLibrary)

      // Mark workspace setup as complete (this triggers GtnService to read the preferences)
      await window.onboardingAPI.setWorkspaceSetupComplete(true)

      // Notify App component that wizard is complete
      onOnboardingComplete()
    } catch (error) {
      console.error('Failed to complete workspace setup:', error)
      alert('Failed to complete setup. Please try again.')
    }
  }

  if (isCheckingSteps || currentStep === null) {
    return null // Or a loading spinner
  }

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center draggable">
      <div className="w-screen h-screen flex flex-col bg-gray-900 border-t border-blue-500/30 non-draggable">
        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-12">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <img src={headerLogoSrc} alt="Griptape" className="h-10" />
          </div>

          {currentStep === 'keychain' && showKeychainStep && (
            <KeychainExplanation onContinue={handleKeychainComplete} />
          )}
          {currentStep === 'workspace' && <WorkspaceSetup onComplete={handleWorkspaceComplete} />}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
