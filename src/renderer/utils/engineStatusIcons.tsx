import React from 'react'
import { Loader2, Square } from 'lucide-react'
import type { EngineStatus } from '@/types/global'

interface StatusIconProps {
  status: EngineStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4'
}

const spinnerSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5'
}

export const getStatusIcon = (status: EngineStatus, size: 'sm' | 'md' | 'lg' = 'md') => {
  const dotSizeClass = sizeClasses[size]
  const spinnerSizeClass = spinnerSizeClasses[size]

  switch (status) {
    case 'running':
      return <div className={`${dotSizeClass} bg-green-500 rounded-full`} />
    case 'ready':
      return <Square className={`${spinnerSizeClass} text-red-500 fill-red-500`} />
    case 'initializing':
    case 'not-ready':
      return <Loader2 className={`${spinnerSizeClass} text-blue-500 animate-spin`} />
    case 'error':
      return <div className={`${dotSizeClass} bg-red-500 rounded-full`} />
    default:
      return <div className={`${dotSizeClass} bg-gray-500 rounded-full`} />
  }
}

export const getStatusColor = (status: EngineStatus) => {
  switch (status) {
    case 'running':
      return 'text-green-600 dark:text-green-400'
    case 'ready':
      return 'text-red-600 dark:text-red-400'
    case 'initializing':
    case 'not-ready':
      return 'text-blue-600 dark:text-blue-400'
    case 'error':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

export const getStatusTooltip = (status: EngineStatus) => {
  switch (status) {
    case 'running':
      return 'Engine is running'
    case 'ready':
      return 'Engine is stopped'
    case 'initializing':
    case 'not-ready':
      return 'Setting up environment...'
    case 'error':
      return 'Engine encountered an error'
    default:
      return 'Unknown status'
  }
}

export const StatusIcon: React.FC<StatusIconProps> = ({ status, size = 'md', className }) => {
  return <div className={className}>{getStatusIcon(status, size)}</div>
}
