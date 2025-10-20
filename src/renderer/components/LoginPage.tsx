import { LogIn } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../utils/utils'
import headerLogoSrc from '../../assets/griptape_nodes_header_logo.svg'
import animatedNodesSrc from '../../assets/animated_nodes.svg'

const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const [loginInProgress, setLoginInProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberCredentials, setRememberCredentials] = useState(false)
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)

  // Load saved credential storage preference and platform on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const enabled = await window.onboardingAPI.isCredentialStorageEnabled()
        setRememberCredentials(enabled)

        const platformValue = await window.electronAPI.getPlatform()
        setPlatform(platformValue)
      } catch (error) {
        console.error('Failed to load credential storage preference:', error)
      }
    }
    loadPreference()
  }, [])

  const handleCheckboxChange = async (checked: boolean) => {
    setRememberCredentials(checked)
    if (!checked) {
      setError(null)
    }
    // Persist the preference immediately
    try {
      await window.onboardingAPI.setCredentialStoragePreference(checked)
    } catch (error) {
      console.error('Failed to save credential storage preference:', error)
    }
  }

  const handleLogin = async () => {
    try {
      setError(null)
      setLoginInProgress(true)

      await login()

      // The login promise will resolve when auth completes and automatically redirect
      // Credentials are stored in-memory for now
      // If user checked "remember credentials", they'll be persisted during onboarding
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed')
      setLoginInProgress(false)
    }
  }

  const openExternalLink = (url: string) => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center draggable">
      <div className="w-screen h-screen flex flex-col bg-gray-900 border-t border-blue-500/30 non-draggable">
        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-8 py-12 flex flex-col items-center">
          <div className="w-full max-w-3xl flex flex-col items-center flex-1 justify-center">
            {/* Logo */}
            <div className="mb-8">
              <img src={headerLogoSrc} alt="Griptape" className="h-16" />
            </div>

            {/* Animation */}
            <div className="mb-12">
              <img
                src={animatedNodesSrc}
                alt="Animated Griptape Nodes"
                className="w-full max-w-md"
              />
            </div>

            {/* Login content */}
            <div className="w-full max-w-md space-y-8">
              <div
                className={cn(
                  'p-6 rounded-md border',
                  loginInProgress
                    ? 'bg-green-900/20 border-green-700'
                    : 'bg-sky-900/20 border-sky-700'
                )}
              >
                <h3 className="text-white font-medium mb-2 text-lg">
                  {loginInProgress ? 'Authenticating' : 'Login Required'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {loginInProgress
                    ? 'Complete the login process in the authentication window.'
                    : 'Please log in with your Griptape account to continue'}
                </p>
              </div>

              <button
                onClick={handleLogin}
                disabled={loginInProgress}
                className={cn(
                  'w-full flex items-center justify-center gap-3',
                  'bg-sky-700 hover:bg-sky-500 active:bg-sky-300',
                  'text-white font-medium text-base',
                  'px-6 py-4 rounded-md',
                  'transition-colors',
                  loginInProgress && 'opacity-50 cursor-not-allowed'
                )}
              >
                <LogIn className="w-5 h-5" />
                Log In
              </button>

              {/* Credential Storage Checkbox */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberCredentials}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-sky-600 focus:ring-sky-500 focus:ring-offset-gray-900"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                      Remember my credentials
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Securely stores your credentials.
                      {platform === 'darwin' &&
                        " On macOS, you'll be prompted to grant keychain access after login."}
                    </p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="mt-6">
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-md">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center gap-4 p-6 pt-4 border-t border-gray-700/50 text-sm">
          <span className="text-gray-500">Need Help?</span>
          <button
            onClick={() => openExternalLink('https://docs.griptapenodes.com/en/stable/')}
            className="text-blue-400 hover:underline"
          >
            Documentation
          </button>
          <button
            onClick={() => openExternalLink('https://docs.griptapenodes.com/en/stable/faq')}
            className="text-blue-400 hover:underline"
          >
            FAQ
          </button>
          <button
            onClick={() => openExternalLink('https://discord.gg/griptape')}
            className="text-blue-400 hover:underline"
          >
            Discord
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
