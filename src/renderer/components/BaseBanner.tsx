import React from 'react'
import { X, Settings } from 'lucide-react'
import { cn } from '../utils/utils'

export type BannerColorScheme = 'blue' | 'purple' | 'amber' | 'red'

interface BaseBannerProps {
  /** Color scheme for the banner (blue for app updates, purple for engine updates) */
  colorScheme: BannerColorScheme
  /** Whether the banner is in an error state (overrides colorScheme with red) */
  hasError?: boolean
  /** Left side content (icon + message) */
  children: React.ReactNode
  /** Action buttons to show on the right side */
  actions?: React.ReactNode
  /** Called when dismiss button is clicked */
  onDismiss: () => void
  /** Called when settings link is clicked */
  onNavigateToSettings?: () => void
  /** Whether interactions should be disabled */
  disabled?: boolean
  /** Whether to show the settings link */
  showSettingsLink?: boolean
}

const colorClasses: Record<
  BannerColorScheme | 'red',
  {
    bg: string
    border: string
    text: string
    textMuted: string
    hover: string
  }
> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
    textMuted: 'text-blue-700 dark:text-blue-300',
    hover: 'hover:bg-blue-100 dark:hover:bg-blue-800/50'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-600 dark:text-purple-400',
    textMuted: 'text-purple-700 dark:text-purple-300',
    hover: 'hover:bg-purple-100 dark:hover:bg-purple-800/50'
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    textMuted: 'text-amber-700 dark:text-amber-300',
    hover: 'hover:bg-amber-100 dark:hover:bg-amber-800/50'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-600 dark:text-red-400',
    textMuted: 'text-red-700 dark:text-red-300',
    hover: 'hover:bg-red-100 dark:hover:bg-red-800/50'
  }
}

export const BaseBanner: React.FC<BaseBannerProps> = ({
  colorScheme,
  hasError = false,
  children,
  actions,
  onDismiss,
  onNavigateToSettings,
  disabled = false,
  showSettingsLink = false
}) => {
  const effectiveScheme = hasError ? 'red' : colorScheme
  const colors = colorClasses[effectiveScheme]

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 px-4',
        colors.bg,
        'border-b',
        colors.border
      )}
    >
      <div className="flex items-center gap-2">{children}</div>

      <div className="flex items-center gap-2">
        {actions}

        {showSettingsLink && onNavigateToSettings && (
          <button
            onClick={onNavigateToSettings}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs',
              colors.text,
              'hover:underline transition-colors'
            )}
          >
            <Settings className="w-3 h-3" />
            Manage
          </button>
        )}

        <button
          onClick={onDismiss}
          disabled={disabled}
          className={cn(
            'p-1 rounded-md transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            colors.text,
            colors.hover
          )}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/** Shared button styles for banner actions */
export const BannerButton: React.FC<{
  onClick: () => void
  disabled?: boolean
  variant: 'primary' | 'secondary'
  colorScheme: BannerColorScheme
  children: React.ReactNode
}> = ({ onClick, disabled, variant, colorScheme, children }) => {
  const baseClasses =
    'px-3 py-1 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  if (variant === 'primary') {
    const bgColors: Record<BannerColorScheme, string> = {
      blue: 'bg-blue-600 hover:bg-blue-700',
      purple: 'bg-purple-600 hover:bg-purple-700',
      amber: 'bg-amber-600 hover:bg-amber-700',
      red: 'bg-red-600 hover:bg-red-700'
    }
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(baseClasses, bgColors[colorScheme], 'text-white')}
      >
        {children}
      </button>
    )
  }

  // Secondary variant
  const borderColors: Record<BannerColorScheme, string> = {
    blue: 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    purple:
      'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30',
    amber:
      'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
    red: 'border-red-600 text-red-600 dark:text-red-400 dark:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseClasses, 'border', borderColors[colorScheme])}
    >
      {children}
    </button>
  )
}

/** Get icon color class for a color scheme */
export const getIconColorClass = (colorScheme: BannerColorScheme, hasError?: boolean): string => {
  const scheme = hasError ? 'red' : colorScheme
  return colorClasses[scheme].text
}

/** Get text color class for a color scheme */
export const getTextColorClass = (colorScheme: BannerColorScheme, hasError?: boolean): string => {
  const scheme = hasError ? 'red' : colorScheme
  return colorClasses[scheme].textMuted
}

export default BaseBanner
