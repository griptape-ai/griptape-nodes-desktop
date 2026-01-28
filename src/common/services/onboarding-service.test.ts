import { OnboardingService } from './onboarding-service'

describe('OnboardingService', () => {
  let service: OnboardingService

  beforeEach(() => {
    service = new OnboardingService()
  })

  describe('onboarding completion', () => {
    it('should return false by default for isOnboardingComplete', () => {
      expect(service.isOnboardingComplete()).toBe(false)
    })

    it('should set and get onboarding complete status', () => {
      service.setOnboardingComplete(true)
      expect(service.isOnboardingComplete()).toBe(true)

      service.setOnboardingComplete(false)
      expect(service.isOnboardingComplete()).toBe(false)
    })
  })

  describe('credential storage', () => {
    it('should return true by default for isCredentialStorageEnabled', () => {
      expect(service.isCredentialStorageEnabled()).toBe(true)
    })

    it('should set and get credential storage enabled status', () => {
      service.setCredentialStorageEnabled(false)
      expect(service.isCredentialStorageEnabled()).toBe(false)

      service.setCredentialStorageEnabled(true)
      expect(service.isCredentialStorageEnabled()).toBe(true)
    })
  })

  describe('keychain access', () => {
    it('should return false by default for hasKeychainAccess', () => {
      expect(service.hasKeychainAccess()).toBe(false)
    })

    it('should set and get keychain access status', () => {
      service.setKeychainAccessGranted(true)
      expect(service.hasKeychainAccess()).toBe(true)

      service.setKeychainAccessGranted(false)
      expect(service.hasKeychainAccess()).toBe(false)
    })

    it('should return false by default for isKeychainVerificationSeen', () => {
      expect(service.isKeychainVerificationSeen()).toBe(false)
    })

    it('should set and get keychain verification seen status', () => {
      service.setKeychainVerificationSeen(true)
      expect(service.isKeychainVerificationSeen()).toBe(true)
    })
  })

  describe('workspace setup', () => {
    it('should return false by default for isWorkspaceSetupComplete', () => {
      expect(service.isWorkspaceSetupComplete()).toBe(false)
    })

    it('should set and get workspace setup complete status', () => {
      service.setWorkspaceSetupComplete(true)
      expect(service.isWorkspaceSetupComplete()).toBe(true)
    })

    it('should emit workspace-setup-complete event when workspace setup is marked complete', () => {
      const listener = jest.fn()
      service.on('workspace-setup-complete', listener)

      service.setWorkspaceSetupComplete(true)

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should not emit workspace-setup-complete event when set to false', () => {
      const listener = jest.fn()
      service.on('workspace-setup-complete', listener)

      service.setWorkspaceSetupComplete(false)

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('waitForWorkspaceSetup', () => {
    it('should resolve immediately if workspace setup is already complete', async () => {
      service.setWorkspaceSetupComplete(true)

      await expect(service.waitForWorkspaceSetup()).resolves.toBeUndefined()
    })

    it('should wait for workspace-setup-complete event if not complete', async () => {
      const waitPromise = service.waitForWorkspaceSetup()

      // Simulate workspace setup completing after a short delay
      setTimeout(() => {
        service.setWorkspaceSetupComplete(true)
      }, 10)

      await expect(waitPromise).resolves.toBeUndefined()
    })
  })

  describe('library settings', () => {
    it('should return false by default for isAdvancedLibraryEnabled', () => {
      expect(service.isAdvancedLibraryEnabled()).toBe(false)
    })

    it('should set and get advanced library enabled status', () => {
      service.setAdvancedLibraryEnabled(true)
      expect(service.isAdvancedLibraryEnabled()).toBe(true)

      service.setAdvancedLibraryEnabled(false)
      expect(service.isAdvancedLibraryEnabled()).toBe(false)
    })

    it('should return false by default for isCloudLibraryEnabled', () => {
      expect(service.isCloudLibraryEnabled()).toBe(false)
    })

    it('should set and get cloud library enabled status', () => {
      service.setCloudLibraryEnabled(true)
      expect(service.isCloudLibraryEnabled()).toBe(true)

      service.setCloudLibraryEnabled(false)
      expect(service.isCloudLibraryEnabled()).toBe(false)
    })
  })

  describe('tutorial progress', () => {
    it('should return false by default for isTutorialCompleted', () => {
      expect(service.isTutorialCompleted()).toBe(false)
    })

    it('should set and get tutorial completed status', () => {
      service.setTutorialCompleted(true)
      expect(service.isTutorialCompleted()).toBe(true)
    })

    it('should return 0 by default for getTutorialLastStep', () => {
      expect(service.getTutorialLastStep()).toBe(0)
    })

    it('should set and get tutorial last step', () => {
      service.setTutorialLastStep(5)
      expect(service.getTutorialLastStep()).toBe(5)

      service.setTutorialLastStep(10)
      expect(service.getTutorialLastStep()).toBe(10)
    })
  })

  describe('completeOnboarding', () => {
    it('should set credential storage and mark onboarding complete', () => {
      service.completeOnboarding(true)

      expect(service.isCredentialStorageEnabled()).toBe(true)
      expect(service.isOnboardingComplete()).toBe(true)
    })

    it('should set credential storage to false when passed false', () => {
      service.completeOnboarding(false)

      expect(service.isCredentialStorageEnabled()).toBe(false)
      expect(service.isOnboardingComplete()).toBe(true)
    })
  })

  describe('resetOnboarding', () => {
    it('should reset all onboarding state to defaults', () => {
      // Set all values to non-default
      service.setOnboardingComplete(true)
      service.setCredentialStorageEnabled(true)
      service.setKeychainAccessGranted(true)
      service.setKeychainVerificationSeen(true)
      service.setWorkspaceSetupComplete(true)
      service.setAdvancedLibraryEnabled(true)
      service.setCloudLibraryEnabled(true)
      service.setTutorialCompleted(true)
      service.setTutorialLastStep(5)

      // Reset
      service.resetOnboarding()

      // Verify all values are reset
      expect(service.isOnboardingComplete()).toBe(false)
      expect(service.isCredentialStorageEnabled()).toBe(false)
      expect(service.hasKeychainAccess()).toBe(false)
      expect(service.isKeychainVerificationSeen()).toBe(false)
      expect(service.isWorkspaceSetupComplete()).toBe(false)
      expect(service.isAdvancedLibraryEnabled()).toBe(false)
      expect(service.isCloudLibraryEnabled()).toBe(false)
      expect(service.isTutorialCompleted()).toBe(false)
      expect(service.getTutorialLastStep()).toBe(0)
    })
  })
})
