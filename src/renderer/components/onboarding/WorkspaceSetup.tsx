import React, { useState, useEffect } from 'react'
import { Folder, CheckCircle } from 'lucide-react'
import { cn } from '../../utils/utils'

interface WorkspaceSetupProps {
  onComplete: (workspaceDirectory: string) => void
  onNextLibraries: (workspaceDirectory: string) => void
}

const WorkspaceSetup: React.FC<WorkspaceSetupProps> = ({ onComplete, onNextLibraries }) => {
  const [workspaceDirectory, setWorkspaceDirectory] = useState<string>('')

  useEffect(() => {
    // Load the saved workspace directory, or default if none exists
    const loadWorkspace = async () => {
      try {
        // First try to get saved custom workspace
        const savedWorkspace = await window.griptapeAPI.getWorkspace()

        if (savedWorkspace && savedWorkspace.trim() !== '') {
          // Use saved custom workspace if it exists
          setWorkspaceDirectory(savedWorkspace)
        } else {
          // Fall back to default if no saved workspace
          const defaultWorkspace = await window.griptapeAPI.getDefaultWorkspace()
          setWorkspaceDirectory(defaultWorkspace)
        }
      } catch (err) {
        console.error('Failed to load workspace:', err)
        // On error, try to at least load the default
        try {
          const defaultWorkspace = await window.griptapeAPI.getDefaultWorkspace()
          setWorkspaceDirectory(defaultWorkspace)
        } catch (fallbackErr) {
          console.error('Failed to load default workspace:', fallbackErr)
        }
      }
    }
    loadWorkspace()
  }, [])

  const handleBrowse = async () => {
    try {
      const directory = await window.griptapeAPI.selectDirectory()
      if (directory) {
        setWorkspaceDirectory(directory)
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
      alert('Failed to select directory. Please try again.')
    }
  }

  const handleComplete = () => {
    if (!workspaceDirectory) {
      alert('Please select a workspace directory')
      return
    }
    onComplete(workspaceDirectory)
  }

  const handleNextLibraries = () => {
    if (!workspaceDirectory) {
      alert('Please select a workspace directory')
      return
    }
    onNextLibraries(workspaceDirectory)
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col items-center justify-center min-h-full py-12">
      <div className="w-full space-y-8">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-purple-700/20 flex items-center justify-center">
              <Folder className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          <h2 className="text-3xl font-semibold text-foreground">Workspace Setup</h2>
          <p className="text-muted-foreground text-lg">
            Choose where your workflow files will be saved
          </p>
        </div>

        {/* Workspace directory selector */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Workspace Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workspaceDirectory}
                readOnly
                className={cn(
                  'flex-1 px-4 py-3 text-sm rounded-md',
                  'bg-background border border-input',
                  'text-foreground font-mono'
                )}
                placeholder="Select a directory"
              />
              <button
                onClick={handleBrowse}
                className={cn(
                  'px-6 py-3 text-sm font-medium rounded-md',
                  'bg-purple-600 hover:bg-purple-500 active:bg-purple-400',
                  'text-white transition-colors'
                )}
              >
                Browse
              </button>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>This is where your workflow files will be saved</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>You can change this later in Settings</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>The directory will be created if it doesn&apos;t exist</span>
            </p>
          </div>
        </div>

        {/* Info note */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Tip:</span> Choose a location that&apos;s easy to find
            and has enough storage space for your workflows. The default location works great for
            most users.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3 pt-4">
          <button
            onClick={handleNextLibraries}
            disabled={!workspaceDirectory}
            className={cn(
              'px-6 py-2.5 text-sm font-medium rounded-md',
              'border border-purple-500/50 text-purple-400',
              'hover:bg-purple-500/10 active:bg-purple-500/20',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Next: Libraries (Optional)
          </button>
          <button
            onClick={handleComplete}
            disabled={!workspaceDirectory}
            className={cn(
              'px-6 py-2.5 text-sm font-medium rounded-md',
              'bg-green-600 hover:bg-green-500 active:bg-green-400',
              'text-white transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Complete Setup
          </button>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceSetup
