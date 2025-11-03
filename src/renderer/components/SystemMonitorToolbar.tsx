import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Activity } from 'lucide-react'

interface SystemMetrics {
  cpu: {
    usage: number
    model: string
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
  gpus: Array<{
    model: string
    usage: number
    memory: {
      used: number
      total: number
    }
  }>
}

interface SystemMonitorToolbarProps {
  show: boolean
}

export function SystemMonitorToolbar({ show }: SystemMonitorToolbarProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleMetricsUpdate = useCallback((newMetrics: SystemMetrics) => {
    setMetrics(newMetrics)
  }, [])

  useEffect(() => {
    if (!show) return

    // Start monitoring
    window.systemMonitorAPI.startMonitoring()

    // Subscribe to updates
    window.systemMonitorAPI.onMetricsUpdate(handleMetricsUpdate)

    // Get initial metrics
    window.systemMonitorAPI.getMetrics().then((result) => {
      if (result.success && result.metrics) {
        setMetrics(result.metrics)
      }
    })

    // Cleanup
    return () => {
      window.systemMonitorAPI.stopMonitoring()
      window.systemMonitorAPI.removeMetricsUpdate(handleMetricsUpdate)
    }
  }, [handleMetricsUpdate, show])

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false)
      }
    }

    // Close on escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isExpanded])

  if (!show || !metrics) {
    return null
  }

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`
  }

  const formatMemory = (gb: number) => {
    return `${gb.toFixed(1)} GB`
  }

  const getBarColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getTextColor = (percentage: number) => {
    if (percentage >= 80) return 'text-red-500'
    if (percentage >= 50) return 'text-yellow-500'
    return 'text-green-500'
  }

  // Calculate average GPU usage if multiple GPUs
  const avgGpuUsage =
    metrics.gpus.length > 0
      ? metrics.gpus.reduce((sum, gpu) => sum + (gpu.usage >= 0 ? gpu.usage : 0), 0) /
        metrics.gpus.filter((gpu) => gpu.usage >= 0).length
      : 0

  return (
    <div className="relative flex-shrink-0">
      {/* Collapsed View - Mini Progress Bars */}
      <button
        ref={buttonRef}
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-sidebar-accent rounded-md transition-colors"
        title="System Resources"
      >
        <Activity className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex items-center gap-2 text-xs">
          {/* CPU Mini Bar */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">CPU</span>
            <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getBarColor(metrics.cpu.usage)}`}
                style={{ width: `${Math.min(metrics.cpu.usage, 100)}%` }}
              />
            </div>
            <span className={`text-[10px] font-semibold ${getTextColor(metrics.cpu.usage)}`}>
              {formatPercentage(metrics.cpu.usage)}
            </span>
          </div>

          {/* GPU Mini Bar (if available) */}
          {metrics.gpus.length > 0 && avgGpuUsage >= 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">GPU</span>
              <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getBarColor(avgGpuUsage)}`}
                  style={{ width: `${Math.min(avgGpuUsage, 100)}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold ${getTextColor(avgGpuUsage)}`}>
                {formatPercentage(avgGpuUsage)}
              </span>
            </div>
          )}

          {/* RAM Mini Bar */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">RAM</span>
            <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getBarColor(metrics.memory.percentage)}`}
                style={{ width: `${Math.min(metrics.memory.percentage, 100)}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-semibold ${getTextColor(metrics.memory.percentage)}`}
            >
              {formatPercentage(metrics.memory.percentage)}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded View - Dropdown Popover */}
      {isExpanded && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 bg-popover border border-border rounded-md shadow-lg p-4 z-50 min-w-[400px]"
        >
          <div className="space-y-4">
            {/* CPU Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">CPU</span>
                <span className="text-sm font-semibold">{formatPercentage(metrics.cpu.usage)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getBarColor(metrics.cpu.usage)}`}
                  style={{ width: `${Math.min(metrics.cpu.usage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground truncate">{metrics.cpu.model}</div>
            </div>

            {/* GPU Details */}
            {metrics.gpus.map((gpu, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    GPU {metrics.gpus.length > 1 ? index + 1 : ''}
                  </span>
                  {gpu.usage >= 0 ? (
                    <span className="text-sm font-semibold">{formatPercentage(gpu.usage)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  )}
                </div>
                {gpu.usage >= 0 ? (
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getBarColor(gpu.usage)}`}
                      style={{ width: `${Math.min(gpu.usage, 100)}%` }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-2" />
                )}
                <div className="text-xs text-muted-foreground truncate">{gpu.model}</div>
              </div>
            ))}

            {/* RAM Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">RAM</span>
                <span className="text-sm font-semibold">
                  {formatPercentage(metrics.memory.percentage)}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getBarColor(metrics.memory.percentage)}`}
                  style={{ width: `${Math.min(metrics.memory.percentage, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {formatMemory(metrics.memory.used)} / {formatMemory(metrics.memory.total)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
