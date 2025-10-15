import React, { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { cn } from '../utils/utils'

const UpdateProgressNotification: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleDownloadStarted = () => {
      setIsVisible(true)
      setProgress(0)
    }

    const handleDownloadProgress = (_event: any, progressValue: number) => {
      setProgress(progressValue)
    }

    const handleDownloadComplete = () => {
      setProgress(100)
      // Keep the notification visible for 2 seconds after completion
      setTimeout(() => {
        setIsVisible(false)
      }, 2000)
    }

    window.updateAPI.onDownloadStarted(handleDownloadStarted)
    window.updateAPI.onDownloadProgress(handleDownloadProgress)
    window.updateAPI.onDownloadComplete(handleDownloadComplete)

    return () => {
      window.updateAPI.removeDownloadStarted(handleDownloadStarted)
      window.updateAPI.removeDownloadProgress(handleDownloadProgress)
      window.updateAPI.removeDownloadComplete(handleDownloadComplete)
    }
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 min-w-[320px]">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Downloading Update</h3>
              <span className="text-xs text-muted-foreground font-mono">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300 ease-out',
                  progress === 100 ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            {progress === 100 && (
              <p className="text-xs text-muted-foreground">
                Download complete! You'll be prompted to restart.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UpdateProgressNotification
