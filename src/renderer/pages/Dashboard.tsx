import { FolderOpen, Play, Square, Sparkles, Settings, RotateCcw, FileText } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useEngine } from '../contexts/EngineContext'
import { useTutorial } from '../components/tutorial'
import { cn } from '../utils/utils'
import { getStatusIcon, getStatusColor } from '../utils/engineStatusIcons'
import headerLogoLightSrc from '@/assets/griptape_nodes_header_logo_light.svg'
import headerLogoDarkSrc from '@/assets/griptape_nodes_header_logo.svg'

interface DashboardProps {
  onPageChange: (page: string) => void
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const { status: engineStatus, startEngine, stopEngine } = useEngine()
  const {
    isTutorialCompleted,
    startTutorial,
    isActive: isTutorialActive,
    refreshTutorialState
  } = useTutorial()
  const [workspaceDir, setWorkspaceDir] = useState<string>('')
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)
  const [hasAutoStartedTutorial, setHasAutoStartedTutorial] = useState(false)

  useEffect(() => {
    loadWorkspaceDirectory()
    refreshTutorialState()
    window.griptapeAPI.refreshConfig()

    const handleWorkspaceChanged = (_event: unknown, directory: string) => {
      setWorkspaceDir(directory)
      setLoadingWorkspace(false)
    }

    window.griptapeAPI.onWorkspaceChanged(handleWorkspaceChanged)

    return () => {
      window.griptapeAPI.removeWorkspaceChanged(handleWorkspaceChanged)
    }
  }, [refreshTutorialState])

  // Auto-start tutorial for first-time users
  useEffect(() => {
    if (!isTutorialCompleted && !isTutorialActive && !hasAutoStartedTutorial && !loadingWorkspace) {
      setHasAutoStartedTutorial(true)
      const timer = setTimeout(() => {
        startTutorial()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [
    isTutorialCompleted,
    isTutorialActive,
    hasAutoStartedTutorial,
    startTutorial,
    loadingWorkspace
  ])

  const loadWorkspaceDirectory = async () => {
    try {
      const directory = await window.griptapeAPI.getWorkspace()
      setWorkspaceDir(directory)
    } catch (err) {
      console.error('Failed to load workspace directory:', err)
    } finally {
      setLoadingWorkspace(false)
    }
  }

  const handleEngineToggle = () => {
    if (engineStatus === 'running') {
      stopEngine()
    } else if (engineStatus === 'ready') {
      startEngine()
    }
  }

  const isEngineReady = engineStatus === 'ready'
  const isEngineRunning = engineStatus === 'running'
  const isEngineInitializing = engineStatus === 'initializing'
  const canStartStop = isEngineReady || isEngineRunning

  const getStatusLabel = () => {
    switch (engineStatus) {
      case 'running':
        return 'Running'
      case 'ready':
        return 'Stopped'
      case 'initializing':
        return 'Starting...'
      case 'not-ready':
        return 'Initializing...'
      case 'error':
        return 'Error'
      default:
        return engineStatus
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Logo Section */}
        <div className="flex justify-center py-4" data-tutorial="logo">
          <img
            src={headerLogoLightSrc}
            className="block w-auto h-12 dark:hidden"
            alt="Griptape Nodes Logo"
          />
          <img
            src={headerLogoDarkSrc}
            className="hidden w-auto h-12 dark:block"
            alt="Griptape Nodes Logo"
          />
        </div>

        {/* Hero Button - Start Creating */}
        <div className="text-center space-y-3">
          <button
            onClick={() => onPageChange('editor')}
            disabled={!isEngineRunning}
            data-tutorial="editor-button"
            className={cn(
              'inline-flex items-center justify-center gap-3 px-8 py-4 text-lg font-semibold rounded-xl transition-all group',
              'shadow-lg hover:shadow-xl transform hover:scale-[1.04] active:scale-[0.98]',
              isEngineRunning
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Sparkles className="w-6 h-6 group-hover:animate-sparkle" />
            Start Creating
          </button>
          {!isEngineRunning && (
            <p className="text-sm text-muted-foreground">
              {isEngineInitializing
                ? 'Engine is starting up...'
                : 'Start the engine below to begin'}
            </p>
          )}
        </div>

        {/* Engine Control Card */}
        <div
          className="bg-card rounded-lg shadow-sm border border-border p-6"
          data-tutorial="engine-status"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Engine</h3>
            <button
              onClick={() => onPageChange('engine')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Logs
            </button>
          </div>

          <div className="flex items-center justify-between">
            {/* Status */}
            <div className="flex items-center gap-3">
              {getStatusIcon(engineStatus, 'md')}
              <div>
                <span className={cn('font-medium', getStatusColor(engineStatus))}>
                  {getStatusLabel()}
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEngineRunning
                    ? 'Ready to create workflows'
                    : isEngineReady
                      ? 'Click Start to begin'
                      : isEngineInitializing
                        ? 'Please wait...'
                        : 'Setting up environment...'}
                </p>
              </div>
            </div>

            {/* Start/Stop Button */}
            <button
              onClick={handleEngineToggle}
              disabled={!canStartStop}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                isEngineRunning
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                !canStartStop && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isEngineRunning ? (
                <>
                  <Square className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>

        {/* Workspace Card */}
        <div
          className="bg-card rounded-lg shadow-sm border border-border p-6"
          data-tutorial="workspace"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Workspace</h3>
            <button
              onClick={() => onPageChange('settings')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
          <div className="flex items-start gap-2">
            <FolderOpen className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-mono text-muted-foreground break-all">
                {loadingWorkspace ? 'Loading...' : workspaceDir || 'Not configured'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your workflows and project files are saved here.
              </p>
            </div>
          </div>
        </div>

        {/* Retake Tutorial Link */}
        <div className="flex justify-center pt-2">
          <button
            onClick={startTutorial}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {isTutorialCompleted ? 'Retake the tutorial' : 'Start the tutorial'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
