import {
  FolderOpen,
  Play,
  Square,
  Rocket,
  Settings,
  RotateCcw,
  FileText,
  ChevronRight,
  Workflow,
  X
} from 'lucide-react'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useEngine } from '../contexts/EngineContext'
import { useTutorial } from '../components/tutorial'
import { cn } from '../utils/utils'
import { getStatusIcon, getStatusColor } from '../utils/engineStatusIcons'
import headerLogoLightSrc from '@/assets/griptape_nodes_header_logo_light.svg'
import headerLogoDarkSrc from '@/assets/griptape_nodes_header_logo.svg'

interface DashboardProps {
  onPageChange: (page: string, path?: string, options?: { openWorkflowModal?: boolean }) => void
}

// Pure utility function - no component dependencies
const formatRelativeTime = (timestamp: number): string => {
  if (timestamp === 0) return ''
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

// Generate a muted HSL color based on the first character of the workflow name
// This matches the approach used in griptape-vsl-gui for consistent placeholders
const getMutedHslColorForChar = (char: string): string => {
  const baseHue = ((char.toUpperCase().charCodeAt(0) - 65) * 13) % 360
  return `hsl(${baseHue}, 20%, 30%)`
}

// Workflow type used throughout the dashboard
type WorkflowData = {
  path: string
  modifiedTime: number
  thumbnail?: string
  name?: string
  description?: string
}

// Memoized workflow item component to prevent unnecessary re-renders
interface WorkflowItemProps {
  workflow: WorkflowData
  isEngineRunning: boolean
  onOpen: (path: string) => void
  onShowDetails: (workflow: WorkflowData) => void
}

const WorkflowItem = React.memo<WorkflowItemProps>(
  ({ workflow, isEngineRunning, onOpen, onShowDetails }) => {
    const workflowFile = workflow.path.split(/[/\\]/).pop() || ''
    const workflowName = workflow.name || workflowFile.replace(/\.[^/.]+$/, '')
    const modifiedTime = formatRelativeTime(workflow.modifiedTime)

    const handleRowClick = useCallback(() => {
      onShowDetails(workflow)
    }, [workflow, onShowDetails])

    const handleOpenClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        const urlName = workflowFile.replace(/\.[^/.]+$/, '')
        onOpen(`/${urlName}`)
      },
      [workflowFile, onOpen]
    )

    return (
      <div
        className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
        <div className="flex items-center gap-3 min-w-0">
          {workflow.thumbnail ? (
            <img
              src={workflow.thumbnail}
              alt={workflowName}
              className="w-10 h-10 rounded object-cover flex-shrink-0 bg-muted"
            />
          ) : (
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: getMutedHslColorForChar(workflowName.charAt(0) || 'A') }}
            >
              <span className="text-xs font-semibold text-white">
                {(workflowName.charAt(0) || 'W').toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-foreground truncate">{workflowName}</p>
            {modifiedTime && <p className="text-xs text-muted-foreground/60">{modifiedTime}</p>}
          </div>
        </div>
        {workflow.description && (
          <p className="text-xs text-muted-foreground truncate flex-1 mr-auto">
            {workflow.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleOpenClick}
            disabled={!isEngineRunning}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors',
              isEngineRunning
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            Open
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    )
  }
)

WorkflowItem.displayName = 'WorkflowItem'

const MAX_VISIBLE_WORKFLOWS = 5

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
  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)
  const [isRocketLaunching, setIsRocketLaunching] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null)

  // Memoized computed values
  const visibleWorkflows = useMemo(() => workflows.slice(0, MAX_VISIBLE_WORKFLOWS), [workflows])
  const hasMoreWorkflows = workflows.length > MAX_VISIBLE_WORKFLOWS

  // Memoized engine state derivations
  const { isEngineReady, isEngineRunning, isEngineInitializing, canStartStop } = useMemo(
    () => ({
      isEngineReady: engineStatus === 'ready',
      isEngineRunning: engineStatus === 'running',
      isEngineInitializing: engineStatus === 'initializing',
      canStartStop: engineStatus === 'ready' || engineStatus === 'running'
    }),
    [engineStatus]
  )

  // Memoized async loaders
  const loadWorkspaceDirectory = useCallback(async () => {
    try {
      const directory = await window.griptapeAPI.getWorkspace()
      setWorkspaceDir(directory)
    } catch (err) {
      console.error('Failed to load workspace directory:', err)
    } finally {
      setLoadingWorkspace(false)
    }
  }, [])

  const loadWorkflows = useCallback(async () => {
    try {
      const workflowList = await window.griptapeAPI.getWorkflows()
      setWorkflows(workflowList)
    } catch (err) {
      console.error('Failed to load workflows:', err)
    } finally {
      setLoadingWorkflows(false)
    }
  }, [])

  // Initial data loading - runs once on mount
  useEffect(() => {
    loadWorkspaceDirectory()
    loadWorkflows()
    refreshTutorialState()
    window.griptapeAPI.refreshConfig()
  }, [loadWorkspaceDirectory, loadWorkflows, refreshTutorialState])

  // Workspace change listener - separate effect for cleaner cleanup
  useEffect(() => {
    const handleWorkspaceChanged = (_event: unknown, directory: string) => {
      setWorkspaceDir(directory)
      setLoadingWorkspace(false)
    }

    window.griptapeAPI.onWorkspaceChanged(handleWorkspaceChanged)

    return () => {
      window.griptapeAPI.removeWorkspaceChanged(handleWorkspaceChanged)
    }
  }, [])

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

  // Memoized event handlers
  const handleEngineToggle = useCallback(() => {
    if (engineStatus === 'running') {
      stopEngine()
    } else if (engineStatus === 'ready') {
      startEngine()
    }
  }, [engineStatus, startEngine, stopEngine])

  const getStatusLabel = useCallback(() => {
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
  }, [engineStatus])

  // Memoized navigation handler for workflow items
  const handleWorkflowNavigate = useCallback(
    (path: string) => {
      onPageChange('editor', path)
    },
    [onPageChange]
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 w-full">
        {/* Logo Section */}
        <div className="flex items-center justify-between py-4" data-tutorial="logo">
          <div className="w-10" /> {/* Spacer for centering */}
          <div className="flex justify-center">
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
          <button
            onClick={() => onPageChange('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground bg-muted/50 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Hero Button - Launch Editor */}
        <div className="text-center space-y-3">
          <button
            onClick={() => {
              if (!isEngineRunning || isRocketLaunching) return
              setIsRocketLaunching(true)
              setTimeout(() => {
                onPageChange('editor')
                setIsRocketLaunching(false)
              }, 400)
            }}
            disabled={!isEngineRunning || isRocketLaunching}
            data-tutorial="editor-button"
            className={cn(
              'inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold rounded-xl transition-all group',
              'shadow-lg hover:shadow-xl transform hover:scale-[1.04] active:scale-[0.98]',
              isEngineRunning
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Rocket
              className={cn(
                'w-5 h-5',
                isRocketLaunching
                  ? 'animate-rocket-launch'
                  : isEngineRunning && 'group-hover:animate-rocket-rumble'
              )}
            />
            Launch Editor
          </button>
          {!isEngineRunning && (
            <p className="text-sm text-muted-foreground">
              {isEngineInitializing
                ? 'Engine is starting up...'
                : 'Start the engine below to begin'}
            </p>
          )}
        </div>

        {/* Workflows Card */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Recent Workflows</h3>
          </div>
          <div className="space-y-2">
            {loadingWorkflows ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : workflows.length === 0 ? (
              <div className="flex items-start gap-2">
                <Workflow className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Your most recent workflows will show up here.
                </p>
              </div>
            ) : (
              <>
                {visibleWorkflows.map((workflow) => (
                  <WorkflowItem
                    key={workflow.path}
                    workflow={workflow}
                    isEngineRunning={isEngineRunning}
                    onOpen={handleWorkflowNavigate}
                    onShowDetails={setSelectedWorkflow}
                  />
                ))}
                {hasMoreWorkflows && (
                  <button
                    onClick={() => onPageChange('editor', undefined, { openWorkflowModal: true })}
                    className="flex items-center justify-center gap-1.5 w-full p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
                  >
                    Show all {workflows.length} workflows
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
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
              onClick={() => {
                onPageChange('settings')
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('scroll-to-workspace'))
                }, 100)
              }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <FolderOpen className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-mono text-muted-foreground truncate"
                title={workspaceDir || undefined}
              >
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

      {/* Workflow Details Modal */}
      {selectedWorkflow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedWorkflow(null)}
        >
          <div
            className="bg-card rounded-lg shadow-lg border border-border w-full max-w-lg m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold truncate">
                {selectedWorkflow.name ||
                  selectedWorkflow.path
                    .split(/[/\\]/)
                    .pop()
                    ?.replace(/\.[^/.]+$/, '')}
              </h2>
              <button
                onClick={() => setSelectedWorkflow(null)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Thumbnail */}
              <div className="flex justify-center">
                {selectedWorkflow.thumbnail ? (
                  <img
                    src={selectedWorkflow.thumbnail}
                    alt={selectedWorkflow.name || 'Workflow'}
                    className="max-w-full max-h-48 rounded-lg object-contain bg-muted"
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: getMutedHslColorForChar(
                        (selectedWorkflow.name || 'W').charAt(0)
                      )
                    }}
                  >
                    <span className="text-3xl font-semibold text-white">
                      {(selectedWorkflow.name || 'W').charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedWorkflow.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm text-foreground">{selectedWorkflow.description}</p>
                </div>
              )}

              {/* Modified time */}
              {selectedWorkflow.modifiedTime > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Modified</h3>
                  <p className="text-sm text-foreground">
                    {formatRelativeTime(selectedWorkflow.modifiedTime)}
                  </p>
                </div>
              )}

              {/* Path */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">File Path</h3>
                <p className="text-xs text-muted-foreground font-mono break-all">
                  {selectedWorkflow.path}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => setSelectedWorkflow(null)}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const workflowFile = selectedWorkflow.path.split(/[/\\]/).pop() || ''
                  const urlName = workflowFile.replace(/\.[^/.]+$/, '')
                  handleWorkflowNavigate(`/${urlName}`)
                  setSelectedWorkflow(null)
                }}
                disabled={!isEngineRunning}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  isEngineRunning
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
              >
                Open in Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
