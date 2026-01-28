import React, { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FileSearch, FolderOpen, Check, AlertCircle, Loader2, Key } from 'lucide-react'
import { cn } from '../../utils/utils'
import type { ConfigFileResult } from '@/types/global'

interface MigrationSetupProps {
  onComplete: (workspaceDirectory?: string) => void
  onBack: () => void
}

type MigrationState = 'checking' | 'found' | 'not-found' | 'scanning' | 'importing' | 'error'

const MigrationSetup: React.FC<MigrationSetupProps> = ({ onComplete, onBack }) => {
  const [state, setState] = useState<MigrationState>('checking')
  const [configFiles, setConfigFiles] = useState<ConfigFileResult[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkDefaultLocations = useCallback(async () => {
    setState('checking')
    setError(null)

    try {
      const results = await window.migrationAPI.checkDefaultLocations()
      const validConfigs = results.filter((r) => r.isValid)

      if (validConfigs.length > 0) {
        setConfigFiles(validConfigs)
        setSelectedPath(validConfigs[0].path)
        setState('found')
      } else {
        setState('not-found')
      }
    } catch (err) {
      console.error('Error checking default locations:', err)
      setState('error')
      setError('Failed to check for existing configuration files')
    }
  }, [])

  useEffect(() => {
    checkDefaultLocations()
  }, [checkDefaultLocations])

  const handleScanEverywhere = async () => {
    setState('scanning')
    setError(null)

    try {
      const results = await window.migrationAPI.scanHomeDirectory()
      const validConfigs = results.filter((r) => r.isValid)

      if (validConfigs.length > 0) {
        setConfigFiles(validConfigs)
        setSelectedPath(validConfigs[0].path)
        setState('found')
      } else {
        setState('not-found')
        setError('No configuration files found in your home directory')
      }
    } catch (err) {
      console.error('Error scanning home directory:', err)
      setState('error')
      setError('Failed to scan for configuration files')
    }
  }

  const handleBrowse = async () => {
    try {
      const filePath = await window.migrationAPI.selectConfigFile()
      if (filePath) {
        const result = await window.migrationAPI.validateConfig(filePath)
        if (result.isValid) {
          // Add to existing configs if not already present
          setConfigFiles((prev) => {
            const exists = prev.some((c) => c.path === result.path)
            return exists ? prev : [...prev, result]
          })
          setSelectedPath(result.path)
          setState('found')
        } else {
          setError(result.error || 'Invalid configuration file')
          setState('error')
        }
      }
    } catch (err) {
      console.error('Error selecting config file:', err)
      setError('Failed to select configuration file')
      setState('error')
    }
  }

  const handleImport = async () => {
    if (!selectedPath) return

    setState('importing')
    setError(null)

    try {
      const result = await window.migrationAPI.importConfig(selectedPath)
      if (result.success) {
        onComplete(result.workspaceDirectory)
      } else {
        setError(result.error || 'Failed to import configuration')
        setState('error')
      }
    } catch (err) {
      console.error('Error importing config:', err)
      setError('Failed to import configuration')
      setState('error')
    }
  }

  const handleSkip = () => {
    onComplete(undefined)
  }

  const selectedConfig = configFiles.find((c) => c.path === selectedPath)

  return (
    <div className="max-w-3xl w-full">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-700/20 flex items-center justify-center">
              <FileSearch className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <h2 className="text-3xl font-semibold text-foreground">Import Configuration</h2>
          <p className="text-muted-foreground text-lg">
            Import your existing Griptape Nodes configuration
          </p>
        </div>

        {/* Content based on state */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          {/* Checking state */}
          {state === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-muted-foreground">Checking for existing configuration...</p>
            </div>
          )}

          {/* Scanning state */}
          {state === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-muted-foreground">Scanning for configuration files...</p>
              <p className="text-sm text-muted-foreground/70">This may take a moment</p>
            </div>
          )}

          {/* Importing state */}
          {state === 'importing' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              <p className="text-muted-foreground">Importing configuration...</p>
            </div>
          )}

          {/* Found configs */}
          {state === 'found' && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">
                Select configuration to import:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {configFiles.map((config) => (
                  <div
                    key={config.path}
                    onClick={() =>
                      setSelectedPath(selectedPath === config.path ? null : config.path)
                    }
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors',
                      'border',
                      selectedPath === config.path
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPath === config.path}
                      onChange={() => {}}
                      className="mt-1 accent-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-foreground truncate">{config.path}</p>
                      {config.workspaceDirectory && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Workspace: {config.workspaceDirectory}
                        </p>
                      )}
                      {config.hasEnvFile && (
                        <div className="flex items-center gap-1 mt-1">
                          <Key className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">API key included</span>
                        </div>
                      )}
                    </div>
                    {selectedPath === config.path && (
                      <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {selectedConfig && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-1">
                    What will be imported:
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                    {selectedConfig.workspaceDirectory && (
                      <li>
                        Workspace:{' '}
                        <span className="font-mono text-xs">
                          {selectedConfig.workspaceDirectory}
                        </span>
                      </li>
                    )}
                    {selectedConfig.hasEnvFile && <li>API key from .env file</li>}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Your current settings will be replaced. Workspace files will not be modified.
                  </p>
                </div>
              )}

              <button
                onClick={handleBrowse}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md',
                  'border border-border text-muted-foreground',
                  'hover:bg-muted/50 transition-colors',
                )}
              >
                Browse for another...
              </button>
            </div>
          )}

          {/* Not found state */}
          {state === 'not-found' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
                <p className="text-muted-foreground text-center">
                  {error || 'No configuration found in default locations'}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleBrowse}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-md',
                    'border border-border text-foreground',
                    'hover:bg-muted/50 transition-colors',
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse for config file
                </button>
                <button
                  onClick={handleScanEverywhere}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-md',
                    'border border-border text-foreground',
                    'hover:bg-muted/50 transition-colors',
                  )}
                >
                  <FileSearch className="w-4 h-4" />
                  Scan home directory
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-4 space-y-2">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-red-400 text-center">{error || 'An error occurred'}</p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={checkDefaultLocations}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-md',
                    'border border-border text-foreground',
                    'hover:bg-muted/50 transition-colors',
                  )}
                >
                  Try again
                </button>
                <button
                  onClick={handleBrowse}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium rounded-md',
                    'border border-border text-foreground',
                    'hover:bg-muted/50 transition-colors',
                  )}
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse for config file
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-between pt-4">
          <button
            onClick={onBack}
            disabled={state === 'checking' || state === 'scanning' || state === 'importing'}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md',
              'text-muted-foreground hover:text-foreground',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-3">
            {/* Show Skip button for not-found and error states */}
            {(state === 'not-found' || state === 'error') && (
              <button
                onClick={handleSkip}
                className={cn(
                  'px-6 py-2.5 text-sm font-medium rounded-md',
                  'border border-border text-muted-foreground',
                  'hover:bg-muted/50 transition-colors',
                )}
              >
                Skip Migration
              </button>
            )}
            {/* Show Continue button for found state */}
            {state === 'found' && (
              <button
                onClick={selectedPath === null ? handleSkip : handleImport}
                className={cn(
                  'px-6 py-2.5 text-sm font-medium rounded-md',
                  'bg-blue-600 hover:bg-blue-500 active:bg-blue-400',
                  'text-white transition-colors',
                )}
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(MigrationSetup)
