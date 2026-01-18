import Store from 'electron-store'
import EventEmitter from 'events'
import { logger } from '@/main/utils/logger'

interface OnboardingServiceEvents {
  'workspace-setup-complete': []
}

interface OnboardingSchema {
  onboardingComplete: boolean
  credentialStorageEnabled: boolean
  keychainAccessGranted: boolean
  keychainVerificationSeen: boolean
  workspaceSetupComplete: boolean
  advancedLibraryEnabled: boolean
  cloudLibraryEnabled: boolean
}

export class OnboardingService extends EventEmitter<OnboardingServiceEvents> {
  private store: any

  constructor() {
    super()
    // Simple JSON file storage - won't trigger keychain access
    this.store = new Store<OnboardingSchema>({
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
    if (complete) {
      this.emit('workspace-setup-complete')
    }
  }

  async waitForWorkspaceSetup(): Promise<void> {
    if (this.isWorkspaceSetupComplete()) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.once('workspace-setup-complete', () => resolve()))
  }

  isAdvancedLibraryEnabled(): boolean {
    return this.store.get('advancedLibraryEnabled', false)
  }

  setAdvancedLibraryEnabled(enabled: boolean): void {
    this.store.set('advancedLibraryEnabled', enabled)
    logger.info('OnboardingService: Advanced library enabled set to', enabled)
  }

  isCloudLibraryEnabled(): boolean {
    return this.store.get('cloudLibraryEnabled', false)
  }

  setCloudLibraryEnabled(enabled: boolean): void {
    this.store.set('cloudLibraryEnabled', enabled)
    logger.info('OnboardingService: Cloud library enabled set to', enabled)
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
    this.store.set('advancedLibraryEnabled', false)
    this.store.set('cloudLibraryEnabled', false)
    logger.info('OnboardingService: Onboarding state reset')
  }
}
