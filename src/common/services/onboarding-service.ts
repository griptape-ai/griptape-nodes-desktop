import Store from 'electron-store'
import { logger } from '@/main/utils/logger'

export class OnboardingService {
  private store: any

  constructor() {
    // Simple JSON file storage - won't trigger keychain access
    this.store = new Store({
      name: 'onboarding'
    })
  }

  start() {
    logger.info('OnboardingService: Started')
  }

  isOnboardingComplete(): boolean {
    return this.store.get('onboardingComplete', false)
  }

  isCredentialStorageEnabled(): boolean {
    return this.store.get('credentialStorageEnabled', true)
  }

  setOnboardingComplete(complete: boolean): void {
    this.store.set('onboardingComplete', complete)
    logger.info('OnboardingService: Onboarding complete set to', complete)
  }

  setCredentialStorageEnabled(enabled: boolean): void {
    this.store.set('credentialStorageEnabled', enabled)
    logger.info('OnboardingService: Credential storage enabled set to', enabled)
  }

  setKeychainAccessGranted(granted: boolean): void {
    this.store.set('keychainAccessGranted', granted)
    logger.info('OnboardingService: Keychain access granted set to', granted)
  }

  hasKeychainAccess(): boolean {
    return this.store.get('keychainAccessGranted', false)
  }

  isKeychainVerificationSeen(): boolean {
    return this.store.get('keychainVerificationSeen', false)
  }

  setKeychainVerificationSeen(seen: boolean): void {
    this.store.set('keychainVerificationSeen', seen)
    logger.info('OnboardingService: Keychain verification seen set to', seen)
  }

  isWorkspaceSetupComplete(): boolean {
    return this.store.get('workspaceSetupComplete', false)
  }

  setWorkspaceSetupComplete(complete: boolean): void {
    this.store.set('workspaceSetupComplete', complete)
    logger.info('OnboardingService: Workspace setup complete set to', complete)
  }

  completeOnboarding(credentialStorageEnabled: boolean): void {
    this.setCredentialStorageEnabled(credentialStorageEnabled)
    this.setOnboardingComplete(true)
  }

  // For testing/development - reset onboarding state
  resetOnboarding(): void {
    this.store.set('onboardingComplete', false)
    this.store.set('credentialStorageEnabled', false)
    this.store.set('keychainAccessGranted', false)
    this.store.set('keychainVerificationSeen', false)
    this.store.set('workspaceSetupComplete', false)
    logger.info('OnboardingService: Onboarding state reset')
  }
}
