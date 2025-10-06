import React, { useState, useEffect } from 'react';
import KeychainExplanation from './KeychainExplanation';
import WorkspaceSetup from './WorkspaceSetup';
import headerLogoSrc from '../../../assets/griptape_nodes_header_logo.svg';

interface OnboardingWizardProps {
  onOnboardingComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onOnboardingComplete }) => {
  const [currentStep, setCurrentStep] = useState<'keychain' | 'workspace' | null>(null);
  const [showKeychainStep, setShowKeychainStep] = useState(false);
  const [showWorkspaceStep, setShowWorkspaceStep] = useState(false);
  const [isCheckingSteps, setIsCheckingSteps] = useState(true);

  useEffect(() => {
    checkWhichStepsNeeded();
  }, []);

  const checkWhichStepsNeeded = async () => {
    try {
      const platform = await window.electronAPI.getPlatform();
      const hasExistingStore = await window.oauthAPI.hasExistingEncryptedStore();
      const credentialStorageEnabled = await window.onboardingAPI.isCredentialStorageEnabled();
      const workspaceSetupComplete = await window.onboardingAPI.isWorkspaceSetupComplete();

      // Check if keychain step is needed:
      // - macOS platform
      // - User opted to remember credentials
      // - No encrypted store exists yet (haven't done keychain flow)
      const needsKeychainStep = platform === 'darwin' && credentialStorageEnabled && !hasExistingStore;

      // Check if workspace step is needed (first time only)
      const needsWorkspaceStep = !workspaceSetupComplete;

      setShowKeychainStep(needsKeychainStep);
      setShowWorkspaceStep(needsWorkspaceStep);

      // Determine which step to show first
      if (needsKeychainStep) {
        setCurrentStep('keychain');
      } else if (needsWorkspaceStep) {
        setCurrentStep('workspace');
      } else {
        // No steps needed, complete immediately
        onOnboardingComplete();
      }
    } catch (error) {
      console.error('Failed to check which steps are needed:', error);
      // Default to workspace step if check fails
      setShowWorkspaceStep(true);
      setCurrentStep('workspace');
    } finally {
      setIsCheckingSteps(false);
    }
  };

  const handleKeychainComplete = () => {
    // Move to workspace step if needed, otherwise complete
    if (showWorkspaceStep) {
      setCurrentStep('workspace');
    } else {
      onOnboardingComplete();
    }
  };

  const handleWorkspaceComplete = async (workspaceDirectory: string) => {
    try {
      // Mark workspace setup as complete
      await window.onboardingAPI.setWorkspaceSetupComplete(true);

      // Set the workspace directory preference (GTN will pick it up during initialization)
      if (workspaceDirectory) {
        await window.griptapeAPI.setWorkspacePreference(workspaceDirectory);
      }

      // Notify App component that wizard is complete
      onOnboardingComplete();
    } catch (error) {
      console.error('Failed to complete workspace setup:', error);
      alert('Failed to complete setup. Please try again.');
    }
  };

  if (isCheckingSteps || currentStep === null) {
    return null; // Or a loading spinner
  }

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-black/50 draggable">
      <div className="w-[90%] h-[90%] max-w-6xl flex flex-col bg-gray-900 rounded-lg border border-blue-500/30 non-draggable">
        {/* Header with logo */}
        <div className="flex items-center justify-center p-6 pb-4 border-b border-gray-700/50">
          <img src={headerLogoSrc} alt="Griptape" className="h-10" />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-12">
          {currentStep === 'keychain' && showKeychainStep && (
            <KeychainExplanation onContinue={handleKeychainComplete} />
          )}
          {currentStep === 'workspace' && (
            <WorkspaceSetup onComplete={handleWorkspaceComplete} />
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
