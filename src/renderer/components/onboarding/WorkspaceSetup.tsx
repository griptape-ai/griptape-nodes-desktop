import React, { useState, useEffect } from 'react'
import { Folder, CheckCircle, ArrowUpRight, FileCheck, Check, Loader2 } from 'lucide-react'
import { cn } from '../../utils/utils'

type WorkspaceChoice = 'imported' | 'custom'

interface WorkspaceSetupProps {
  onComplete: (workspaceDirectory: string) => void
  onNextLibraries: (workspaceDirectory: string) => void
  onStartMigration?: () => void
  initialWorkspaceDirectory?: string
}

const WorkspaceSetup: React.FC<WorkspaceSetupProps> = ({
  onComplete,
  onNextLibraries,
  onStartMigration,
  initialWorkspaceDirectory
}) => {
  const [workspaceDirectory, setWorkspaceDirectory] = useState<string>('')
  const [customWorkspaceDirectory, setCustomWorkspaceDirectory] = useState<string>('')
  const [workspaceChoice, setWorkspaceChoice] = useState<WorkspaceChoice>('imported')
  const [isCopying, setIsCopying] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  // Track if migration was done
  const hasMigrated = !!initialWorkspaceDirectory

  // Determine the effective workspace directory based on choice
  const effectiveWorkspace = hasMigrated
    ? workspaceChoice === 'imported'
      ? initialWorkspaceDirectory
      : customWorkspaceDirectory
    : workspaceDirectory

  useEffect(() => {
    // If we have an initial workspace from migration, use that
    if (initialWorkspaceDirectory) {
      setWorkspaceDirectory(initialWorkspaceDirectory)
      return
    }

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
  }, [initialWorkspaceDirectory])

  // Load default workspace for custom option
  useEffect(() => {
    if (hasMigrated && !customWorkspaceDirectory) {
      const loadDefault = async () => {
        try {
          const defaultWorkspace = await window.griptapeAPI.getDefaultWorkspace()
          setCustomWorkspaceDirectory(defaultWorkspace)
        } catch (err) {
          console.error('Failed to load default workspace:', err)
        }
      }
      loadDefault()
    }
  }, [hasMigrated, customWorkspaceDirectory])

  const handleBrowse = async () => {
    try {
      const directory = await window.griptapeAPI.selectDirectory()
      if (directory) {
        if (hasMigrated) {
          setCustomWorkspaceDirectory(directory)
          setWorkspaceChoice('custom')
        } else {
          setWorkspaceDirectory(directory)
        }
      }
    } catch (error) {
      console.error('Failed to select directory:', error)
      alert('Failed to select directory. Please try again.')
    }
  }

  // Helper to copy workspace if needed
  const copyWorkspaceIfNeeded = async (): Promise<boolean> => {
    // Only copy if user chose "Copy to a new location" after migration
    if (hasMigrated && workspaceChoice === 'custom' && initialWorkspaceDirectory) {
      setIsCopying(true)
      setCopyError(null)

      try {
        const result = await window.migrationAPI.copyWorkspace(
          initialWorkspaceDirectory,
          customWorkspaceDirectory
        )

        if (!result.success) {
          setCopyError(result.error || 'Failed to copy workspace')
          setIsCopying(false)
          return false
        }

        console.log(`Copied ${result.filesCopied} files to new workspace`)
      } catch (error) {
        console.error('Failed to copy workspace:', error)
        setCopyError('Failed to copy workspace files')
        setIsCopying(false)
        return false
      }

      setIsCopying(false)
    }
    return true
  }

  const handleComplete = async () => {
    if (!effectiveWorkspace) {
      alert('Please select a workspace directory')
      return
    }

    const success = await copyWorkspaceIfNeeded()
    if (success) {
      onComplete(effectiveWorkspace)
    }
  }

  const handleNextLibraries = async () => {
    if (!effectiveWorkspace) {
      alert('Please select a workspace directory')
      return
    }

    const success = await copyWorkspaceIfNeeded()
    if (success) {
      onNextLibraries(effectiveWorkspace)
    }
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

        {/* Workspace directory selector - different UI when migrated */}
        {hasMigrated ? (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <label className="text-sm font-medium text-foreground">Workspace Directory</label>

            {/* Option 1: Use imported workspace */}
            <label
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors border',
                workspaceChoice === 'imported'
                  ? 'border-green-500/50 bg-green-500/5 dark:border-green-500/30'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <input
                type="radio"
                name="workspaceChoice"
                checked={workspaceChoice === 'imported'}
                onChange={() => setWorkspaceChoice('imported')}
                className="mt-1 accent-green-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Use existing workspace
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    <FileCheck className="w-3 h-3" />
                    From config
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Continue using your current workspace location
                </p>
                <p className="text-sm font-mono text-muted-foreground mt-2 truncate">
                  {initialWorkspaceDirectory}
                </p>
              </div>
              {workspaceChoice === 'imported' && (
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
            </label>

            {/* Option 2: Copy to new location */}
            <label
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors border',
                workspaceChoice === 'custom'
                  ? 'border-purple-500/50 bg-purple-500/5 dark:border-purple-500/30'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <input
                type="radio"
                name="workspaceChoice"
                checked={workspaceChoice === 'custom'}
                onChange={() => setWorkspaceChoice('custom')}
                className="mt-1 accent-purple-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Copy to a new location
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Copy your existing workspace files to a new folder
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={customWorkspaceDirectory}
                    readOnly
                    onClick={() => setWorkspaceChoice('custom')}
                    className={cn(
                      'flex-1 px-3 py-2 text-sm rounded-md',
                      'bg-background border border-input',
                      'text-foreground font-mono'
                    )}
                    placeholder="Select a directory"
                  />
                  <button
                    onClick={handleBrowse}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-md',
                      'bg-purple-600 hover:bg-purple-500 active:bg-purple-400',
                      'text-white transition-colors'
                    )}
                  >
                    Browse
                  </button>
                </div>
              </div>
              {workspaceChoice === 'custom' && (
                <Check className="w-5 h-5 text-purple-500 flex-shrink-0" />
              )}
            </label>

            <div className="space-y-2 text-sm text-muted-foreground pt-2">
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>This is where your workflow files will be saved</span>
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>You can change this later in Settings</span>
              </p>
            </div>
          </div>
        ) : (
          /* Standard workspace selector when not migrated */
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
        )}

        {/* Info note */}
        {!hasMigrated && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Tip:</span> Choose a location that&apos;s easy to find
              and has enough storage space for your workflows. The default location works great for
              most users.
            </p>
          </div>
        )}

        {/* Migration option - always visible, shows checkmark when migrated */}
        {onStartMigration && (
          <div
            className={cn(
              'border rounded-lg p-4',
              hasMigrated ? 'border-green-500/50 dark:border-green-500/30' : 'border-border'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {hasMigrated ? 'Configuration imported' : 'Have an existing installation?'}
                  </p>
                  {hasMigrated && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30">
                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasMigrated
                    ? 'Click to import a different configuration'
                    : 'Import your configuration and workspace settings'}
                </p>
              </div>
              <button
                onClick={onStartMigration}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md',
                  'border transition-colors',
                  hasMigrated
                    ? 'border-green-500/50 text-green-600 dark:text-green-400 hover:bg-green-500/10'
                    : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/10 active:bg-blue-500/20'
                )}
              >
                {hasMigrated ? 'Edit' : 'Import'}
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Copy error message */}
        {copyError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{copyError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-3 pt-4">
          <button
            onClick={handleNextLibraries}
            disabled={!effectiveWorkspace || isCopying}
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
            disabled={!effectiveWorkspace || isCopying}
            className={cn(
              'px-6 py-2.5 text-sm font-medium rounded-md',
              'bg-green-600 hover:bg-green-500 active:bg-green-400',
              'text-white transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isCopying ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Copying...
              </span>
            ) : (
              'Complete Setup'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceSetup
