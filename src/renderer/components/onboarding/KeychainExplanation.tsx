import React, { useState } from 'react'
import { Shield, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '../../utils/utils'

interface KeychainExplanationProps {
  onContinue: () => void
}

const KeychainExplanation: React.FC<KeychainExplanationProps> = ({ onContinue }) => {
  const [stage, setStage] = useState<'info' | 'testing' | 'success' | 'error'>('info')

  const startVerificationFlow = async () => {
    setStage('testing')

    // Enable credential storage - this will trigger the keychain prompt
    // and migrate credentials from in-memory to encrypted persistent store
    try {
      const result = await window.onboardingAPI.enableCredentialStorage()

      if (!result.success) {
        console.error('Keychain access denied:', result.error)
        setStage('error')
        return
      }

      console.log('Credential storage enabled, keychain access granted')
      setStage('success')
      // Wait a moment to show success before continuing
      setTimeout(() => {
        onContinue()
      }, 500)
    } catch (err) {
      console.error('Keychain access error:', err)
      setStage('error')
    }
  }

  const handleSkip = async () => {
    // Disable credential storage and continue
    try {
      await window.onboardingAPI.setCredentialStoragePreference(false)
      onContinue()
    } catch (err) {
      console.error('Failed to skip:', err)
    }
  }

  const handleRestart = async () => {
    try {
      await window.electronAPI.restartApp()
    } catch (err) {
      console.error('Failed to restart app:', err)
    }
  }

  return (
    <div className="max-w-3xl w-full">
      <div className="w-full space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-blue-700/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white">Grant Keychain Access</h2>
          <p className="text-gray-400 text-sm">
            To remember your credentials, macOS needs permission to securely store them in the
            system keychain
          </p>
        </div>

        {/* Option explanations */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-white">Understanding the Dialog Options</h3>

          {/* Options in a row: Always Allow, Deny, Allow */}
          <div className="grid grid-cols-3 gap-3">
            {/* Always Allow */}
            <div className="bg-green-900/10 border border-green-700/30 rounded-lg p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <h4 className="font-semibold text-white text-sm">Always Allow</h4>
                </div>
                <p className="text-xs text-gray-400">
                  Recommended. Grants permanent access. If you don&apos;t select this, the prompt
                  will appear immediately when opening the app in the future.
                </p>
              </div>
            </div>

            {/* Deny */}
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <h4 className="font-semibold text-white text-sm">Deny</h4>
                </div>
                <p className="text-xs text-gray-400">
                  Credentials won&apos;t be saved. You&apos;ll need to log in every time you open
                  the app.
                </p>
              </div>
            </div>

            {/* Allow */}
            <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <h4 className="font-semibold text-white text-sm">Allow</h4>
                </div>
                <p className="text-xs text-gray-400">
                  Grants temporary access. macOS may ask again in the future.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-blue-300">
                <span className="font-semibold">Security:</span> Your credentials are encrypted by
                macOS using your login password. Even if someone accesses your computer, they
                can&apos;t read your credentials without your macOS password.
              </p>
            </div>
          </div>
        </div>

        {/* Status/Action box */}
        {stage === 'info' && (
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={handleSkip}
              className={cn(
                'px-6 py-3 rounded-md',
                'bg-gray-700 hover:bg-gray-600',
                'text-white font-medium text-sm',
                'transition-colors',
              )}
            >
              Skip for Now
            </button>
            <button
              onClick={startVerificationFlow}
              className={cn(
                'px-6 py-3 text-sm font-medium rounded-md',
                'bg-sky-700 hover:bg-sky-500 active:bg-sky-300',
                'text-white transition-colors',
              )}
            >
              Save Credentials
            </button>
          </div>
        )}

        {stage === 'testing' && (
          <div className="p-4 rounded-md border bg-yellow-900/20 border-yellow-700 text-center">
            <h3 className="text-white font-medium mb-2 text-base">Waiting for Keychain Response</h3>
            <p className="text-gray-300 text-sm">
              Please respond to the keychain prompt to continue.
            </p>
          </div>
        )}

        {stage === 'success' && (
          <div className="p-4 rounded-md border bg-green-900/20 border-green-700 text-center">
            <div className="text-green-400 text-3xl mb-2">✓</div>
            <h3 className="text-white font-medium mb-2 text-base">Keychain Access Granted</h3>
            <p className="text-gray-300 text-sm">Your credentials will be stored securely.</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 space-y-3">
            <div className="space-y-2">
              <h3 className="text-white font-semibold text-base">Keychain Access Was Denied</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                You clicked &quot;Deny&quot; in the macOS keychain dialog. You have two options:
              </p>
              <ul className="text-gray-300 text-sm leading-relaxed list-disc list-inside space-y-1">
                <li>Restart to grant keychain access and securely save your credentials</li>
                <li>Skip for now</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleRestart}
                className={cn(
                  'px-4 py-2 rounded-md',
                  'bg-gray-700 hover:bg-gray-600',
                  'text-white font-medium text-sm',
                  'transition-colors',
                )}
              >
                Restart
              </button>
              <button
                onClick={handleSkip}
                className={cn(
                  'px-4 py-2 rounded-md',
                  'bg-sky-700 hover:bg-sky-500 active:bg-sky-300',
                  'text-white font-medium text-sm',
                  'transition-colors',
                )}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KeychainExplanation
