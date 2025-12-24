import React from 'react'
import { Download, RotateCcw, AlertCircle } from 'lucide-react'
import { cn } from '../utils/utils'
import { BaseBanner, BannerButton, getIconColorClass, getTextColorClass } from './BaseBanner'

interface EngineUpdateBannerProps {
  currentVersion: string
  latestVersion: string
  isUpdating: boolean
  error: string | null
  onDismiss: () => void
  onUpdate: () => void
  onClearError?: () => void
  onNavigateToSettings?: () => void
}

const EngineUpdateBanner: React.FC<EngineUpdateBannerProps> = ({
  currentVersion,
  latestVersion,
  isUpdating,
  error,
  onDismiss,
  onUpdate,
  onClearError,
  onNavigateToSettings
}) => {
  const hasError = !!error
  const isDisabled = isUpdating
  const colorScheme = 'purple'

  const handleRetry = () => {
    onClearError?.()
    onUpdate()
  }

  const iconClass = getIconColorClass(colorScheme, hasError)
  const textClass = getTextColorClass(colorScheme, hasError)

  const renderContent = () => {
    if (error) {
      return (
        <>
          <AlertCircle className={cn('w-4 h-4', iconClass)} />
          <span className={cn('text-sm', textClass)}>{error}</span>
        </>
      )
    }

    if (isUpdating) {
      return (
        <>
          <RotateCcw className={cn('w-4 h-4 animate-spin', iconClass)} />
          <span className={cn('text-sm', textClass)}>Updating engine to v{latestVersion}...</span>
        </>
      )
    }

    return (
      <>
        <Download className={cn('w-4 h-4', iconClass)} />
        <span className={cn('text-sm', textClass)}>
          A new engine version (v{latestVersion}) is available. Current version: v{currentVersion}
        </span>
      </>
    )
  }

  const renderActions = () => {
    if (error) {
      return (
        <BannerButton onClick={handleRetry} variant="primary" colorScheme="red">
          Retry
        </BannerButton>
      )
    }

    if (isUpdating) {
      return null
    }

    return (
      <BannerButton
        onClick={onUpdate}
        disabled={isDisabled}
        variant="primary"
        colorScheme={colorScheme}
      >
        Download & Restart Engine
      </BannerButton>
    )
  }

  return (
    <BaseBanner
      colorScheme={colorScheme}
      hasError={hasError}
      onDismiss={onDismiss}
      onNavigateToSettings={onNavigateToSettings}
      disabled={isDisabled}
      showSettingsLink={!error && !isUpdating}
      actions={renderActions()}
    >
      {renderContent()}
    </BaseBanner>
  )
}

export default EngineUpdateBanner
