import { FolderOpen } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useEngine } from '../contexts/EngineContext'
import { cn } from '../utils/utils'
import { getStatusIcon, getStatusColor } from '../utils/engineStatusIcons'
import headerLogoLightSrc from '@/assets/griptape_nodes_header_logo_light.svg'
import headerLogoDarkSrc from '@/assets/griptape_nodes_header_logo.svg'

interface DashboardProps {
  onPageChange: (page: string) => void
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const { status: engineStatus } = useEngine()
  const [workspaceDir, setWorkspaceDir] = useState<string>('')
  const [loadingWorkspace, setLoadingWorkspace] = useState(true)

  useEffect(() => {
    loadWorkspaceDirectory()
    window.griptapeAPI.refreshConfig()

    const handleWorkspaceChanged = (event: any, directory: string) => {
      setWorkspaceDir(directory)
      setLoadingWorkspace(false)
    }

    window.griptapeAPI.onWorkspaceChanged(handleWorkspaceChanged)

    return () => {
      window.griptapeAPI.removeWorkspaceChanged(handleWorkspaceChanged)
    }
  }, [])

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Logo Section */}
        <div className="flex justify-center py-8">
          <img
            src={headerLogoLightSrc}
            className="block w-auto h-16 dark:hidden"
            alt="Griptape Nodes Logo"
          />
          <img
            src={headerLogoDarkSrc}
            className="hidden w-auto h-16 dark:block"
            alt="Griptape Nodes Logo"
          />
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome to Griptape Nodes Desktop</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Griptape Nodes Desktop is your local development environment for building AI workflows
              with the Griptape framework. This application manages the Griptape Nodes engine and
              provides easy access to the visual workflow editor.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Getting Started:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Ensure the engine is running (check the status below)</li>
                <li>Click &quot;Open Editor&quot; to launch the visual workflow editor</li>
                <li>
                  In the editor, look for an engine named &quot;Griptape Nodes Desktop&quot; and
                  click &quot;Start Session&quot;
                </li>
                <li>Pick a template or create a new workflow to start building</li>
                <li>Your workflows are saved in the workspace directory shown below</li>
              </ol>
            </div>
            <p className="text-sm">
              The Griptape Nodes engine runs locally and provides the backend services for executing
              your workflows. Use the Engine tab to monitor logs and troubleshoot any issues.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold mb-3">Engine Status</h3>
            <div className="flex items-center gap-2">
              {getStatusIcon(engineStatus, 'md')}
              <span className={`font-medium ${getStatusColor(engineStatus)}`}>
                {engineStatus === 'ready'
                  ? 'Stopped'
                  : engineStatus.charAt(0).toUpperCase() + engineStatus.slice(1).replace('-', ' ')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Manage from the{' '}
              <button
                onClick={() => onPageChange('engine')}
                className="text-primary hover:underline focus:outline-none focus:underline"
              >
                Engine tab
              </button>
            </p>
          </div>

          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h3 className="text-lg font-semibold mb-3">Visual Editor</h3>
            <button
              onClick={() => {
                onPageChange('editor')
              }}
              disabled={engineStatus !== 'running'}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md mb-3',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Open Editor
            </button>
            {engineStatus !== 'running' ? (
              <p className="text-xs text-yellow-600">Start the engine first</p>
            ) : (
              <p className="text-xs text-muted-foreground">Launch the workflow editor</p>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h3 className="text-lg font-semibold mb-3">Workspace</h3>
          <div className="flex items-start gap-2 mb-3">
            <FolderOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
            <p className="text-sm font-mono text-muted-foreground break-all">
              {loadingWorkspace ? 'Loading...' : workspaceDir || 'Not configured'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage from{' '}
            <button
              onClick={() => onPageChange('settings')}
              className="text-primary hover:underline focus:outline-none focus:underline"
            >
              App Settings
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
