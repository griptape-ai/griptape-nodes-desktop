import React, { useState } from 'react'
import { useEngine } from '../contexts/EngineContext'
import WorkspaceSetup from '../components/onboarding/WorkspaceSetup'
import { cn } from '../utils/utils'

interface EngineSetupProps {
  onPageChange: (page: string) => void
}

const EngineSetup: React.FC<EngineSetupProps> = ({ onPageChange }) => {
  const { setOperationMessage, setIsUpgradePending } = useEngine()
  const [isReconfiguring, setIsReconfiguring] = useState(false)

  const handleComplete = async (
    workspaceDirectory: string,
    advancedLibrary: boolean,
    cloudLibrary: boolean
  ) => {
    setIsReconfiguring(true)
    setOperationMessage({
      type: 'info',
      text: 'Reconfiguring engine with new workspace and library settings...'
    })

    try {
      await window.griptapeAPI.reconfigureEngine({
        workspaceDirectory,
        advancedLibrary,
        cloudLibrary
      })

      setOperationMessage({
        type: 'success',
        text: 'Engine setup completed successfully!'
      })

      // Mark as pending so Settings can refresh environment info when engine restarts
      setIsUpgradePending(true)

      // Navigate back to settings after short delay
      setTimeout(() => {
        onPageChange('settings')
      }, 1500)
    } catch (err) {
      console.error('Failed to complete engine setup:', err)
      setOperationMessage({
        type: 'error',
        text: 'Failed to complete engine setup. Please try again.'
      })
      setIsReconfiguring(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Back navigation */}
      <div className="p-4 border-b border-border">
        <button
          onClick={() => onPageChange('settings')}
          disabled={isReconfiguring}
          className={cn(
            'text-sm text-muted-foreground hover:text-foreground transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          ← Back to Settings
        </button>
      </div>

      {/* Reuse existing WorkspaceSetup component */}
      <WorkspaceSetup onComplete={handleComplete} />
    </div>
  )
}

export default EngineSetup
