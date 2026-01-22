import React, { useState, useEffect, useCallback } from 'react'
import KeychainExplanation from './KeychainExplanation'
import WorkspaceSetup from './WorkspaceSetup'
import LibrarySetup from './LibrarySetup'
import headerLogoSrc from '../../../assets/griptape_nodes_header_logo.svg'

interface OnboardingWizardProps {
  onOnboardingComplete: () => void
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onOnboardingComplete }) => {
  const [currentStep, setCurrentStep] = useState<'workspace' | 'libraries' | 'keychain' | null>(
    null
  )
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

      // Determine which step to show first (workspace is always first)
      if (needsWorkspaceStep) {
        setCurrentStep('workspace')
      } else if (needsKeychainStep) {
        setCurrentStep('keychain')
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

  const handleWorkspaceComplete = async (directory: string) => {
    // User chose to complete setup without configuring libraries (use defaults)
    try {
      if (directory) {
        await window.griptapeAPI.setWorkspacePreference(directory)
      }

      // Use default library settings (cloud library enabled, advanced disabled)
      await window.onboardingAPI.setAdvancedLibraryEnabled(false)
      await window.onboardingAPI.setCloudLibraryEnabled(true)

      // Mark workspace setup as complete (this triggers GtnService to read the preferences)
      await window.onboardingAPI.setWorkspaceSetupComplete(true)

      // Move to keychain step if needed, otherwise complete
      if (showKeychainStep) {
        setCurrentStep('keychain')
      } else {
        onOnboardingComplete()
      }
    } catch (error) {
      console.error('Failed to complete workspace setup:', error)
      alert('Failed to complete setup. Please try again.')
    }
  }

  const handleWorkspaceNextLibraries = async (directory: string) => {
    // User chose to configure libraries - save workspace and move to library step
    try {
      if (directory) {
        await window.griptapeAPI.setWorkspacePreference(directory)
      }
    } catch (error) {
      console.error('Failed to save workspace preference:', error)
    }

    // Move to library setup step
    setCurrentStep('libraries')
  }

  const handleLibrariesBack = () => {
    setCurrentStep('workspace')
  }

  const handleLibrariesComplete = async (advancedLibrary: boolean, cloudLibrary: boolean) => {
    try {
      // Set library preferences BEFORE marking setup complete (GTN will pick them up during initialization)
      await window.onboardingAPI.setAdvancedLibraryEnabled(advancedLibrary)
      await window.onboardingAPI.setCloudLibraryEnabled(cloudLibrary)

      // Mark workspace setup as complete (this triggers GtnService to read the preferences)
      await window.onboardingAPI.setWorkspaceSetupComplete(true)

      // Move to keychain step if needed, otherwise complete
      if (showKeychainStep) {
        setCurrentStep('keychain')
      } else {
        onOnboardingComplete()
      }
    } catch (error) {
      console.error('Failed to complete library setup:', error)
      alert('Failed to complete setup. Please try again.')
    }
  }

  const handleKeychainComplete = () => {
    onOnboardingComplete()
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

          {currentStep === 'workspace' && showWorkspaceStep && (
            <WorkspaceSetup
              onComplete={handleWorkspaceComplete}
              onNextLibraries={handleWorkspaceNextLibraries}
            />
          )}
          {currentStep === 'libraries' && (
            <LibrarySetup onComplete={handleLibrariesComplete} onBack={handleLibrariesBack} />
          )}
          {currentStep === 'keychain' && showKeychainStep && (
            <KeychainExplanation onContinue={handleKeychainComplete} />
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizard
