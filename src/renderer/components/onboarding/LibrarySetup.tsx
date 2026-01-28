import React, { useState } from 'react'
import { Package } from 'lucide-react'
import { cn } from '../../utils/utils'

interface LibrarySetupProps {
  onComplete: (advancedLibrary: boolean, cloudLibrary: boolean) => void
  onBack: () => void
}

const LibrarySetup: React.FC<LibrarySetupProps> = ({ onComplete, onBack }) => {
  const [advancedLibrary, setAdvancedLibrary] = useState<boolean>(false)
  const [cloudLibrary, setCloudLibrary] = useState<boolean>(true)
  const [isCompleting, setIsCompleting] = useState(false)

  const handleComplete = () => {
    setIsCompleting(true)
    try {
      onComplete(advancedLibrary, cloudLibrary)
    } catch (error) {
      console.error('Failed to complete library setup:', error)
      setIsCompleting(false)
    }
  }

  return (
    <div className="max-w-3xl w-full">
      <div className="w-full space-y-6">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-purple-700/20 flex items-center justify-center">
              <Package className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <h2 className="text-3xl font-semibold text-foreground">Additional Libraries</h2>
          <p className="text-muted-foreground text-lg">
            Install additional libraries to extend Griptape Nodes capabilities
          </p>
        </div>

        {/* Library options */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={advancedLibrary}
                onChange={(e) => setAdvancedLibrary(e.target.checked)}
                className={cn(
                  'mt-0.5 w-4 h-4 rounded border-input',
                  'text-purple-600 focus:ring-purple-500 focus:ring-offset-0',
                  'bg-background cursor-pointer'
                )}
              />
              <div className="flex-1 space-y-1">
                <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                  Install Advanced Media Library
                </span>
                <p className="text-xs text-muted-foreground">
                  Advanced image processing nodes (requires specific models to function)
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={cloudLibrary}
                onChange={(e) => setCloudLibrary(e.target.checked)}
                className={cn(
                  'mt-0.5 w-4 h-4 rounded border-input',
                  'text-purple-600 focus:ring-purple-500 focus:ring-offset-0',
                  'bg-background cursor-pointer'
                )}
              />
              <div className="flex-1 space-y-1">
                <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                  Install Griptape Cloud Library
                </span>
                <p className="text-xs text-muted-foreground">
                  Nodes for integrating with Griptape Cloud services
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Tip:</span> You can install or uninstall these libraries
            later in the Settings page.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3 pt-4">
          <button
            onClick={onBack}
            disabled={isCompleting}
            className={cn(
              'px-6 py-2.5 text-sm font-medium rounded-md',
              'border border-purple-500/50 text-purple-400',
              'hover:bg-purple-500/10 active:bg-purple-500/20',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Back: Workspace
          </button>
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className={cn(
              'px-6 py-2.5 text-sm font-medium rounded-md',
              'bg-green-600 hover:bg-green-500 active:bg-green-400',
              'text-white transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isCompleting ? 'Setting Up...' : 'Complete Setup'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LibrarySetup
