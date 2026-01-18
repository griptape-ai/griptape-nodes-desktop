import { useState, useEffect, useCallback, useRef } from 'react'
import { Activity } from 'lucide-react'
import { SystemMetrics } from '../types/system-metrics'
import {
  formatPercentage,
  formatMemory,
  getUsageBarColor,
  getUsageTextColor,
  clampPercentage,
  calculateAverageGpuUsage
} from '../utils/system-monitor'

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

  const avgGpuUsage = calculateAverageGpuUsage(metrics.gpus)

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
                className={`h-full transition-all duration-300 ${getUsageBarColor(metrics.cpu.usage)}`}
                style={{ width: `${clampPercentage(metrics.cpu.usage)}%` }}
              />
            </div>
            <span className={`text-[10px] font-semibold ${getUsageTextColor(metrics.cpu.usage)}`}>
              {formatPercentage(metrics.cpu.usage)}
            </span>
          </div>

          {/* GPU Mini Bar (only show if at least one GPU has valid usage data) */}
          {metrics.gpus.some((gpu) => gpu.usage >= 0) && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">GPU</span>
              <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getUsageBarColor(avgGpuUsage)}`}
                  style={{ width: `${clampPercentage(avgGpuUsage)}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold ${getUsageTextColor(avgGpuUsage)}`}>
                {formatPercentage(avgGpuUsage)}
              </span>
            </div>
          )}

          {/* RAM Mini Bar */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
              {metrics.memory.type === 'unified' ? 'MEM' : 'RAM'}
            </span>
            <div className="w-12 bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getUsageBarColor(metrics.memory.percentage)}`}
                style={{ width: `${clampPercentage(metrics.memory.percentage)}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-semibold ${getUsageTextColor(metrics.memory.percentage)}`}
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
                  className={`h-full transition-all duration-300 ${getUsageBarColor(metrics.cpu.usage)}`}
                  style={{ width: `${clampPercentage(metrics.cpu.usage)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground truncate">{metrics.cpu.model}</div>
            </div>

            {/* GPU Details */}
            {metrics.gpus.map((gpu, index) => {
              const hasVram = gpu.memory.total > 0
              const hasUsage = gpu.usage >= 0
              const vramPercentage = hasVram ? (gpu.memory.used / gpu.memory.total) * 100 : 0
              return (
                <div key={`${gpu.model}-${index}`} className={hasUsage ? 'space-y-2' : 'space-y-1'}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      GPU {metrics.gpus.length > 1 ? index + 1 : ''}
                    </span>
                    {hasUsage ? (
                      <span className="text-sm font-semibold">{formatPercentage(gpu.usage)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </div>
                  {hasUsage && (
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getUsageBarColor(gpu.usage)}`}
                        style={{ width: `${clampPercentage(gpu.usage)}%` }}
                      />
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">{gpu.model}</div>

                  {/* VRAM for this GPU */}
                  {hasVram && (
                    <div className="mt-2 pl-2 border-l-2 border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          VRAM
                        </span>
                        <span className="text-sm font-semibold">
                          {formatPercentage(vramPercentage)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden mt-1">
                        <div
                          className={`h-full transition-all duration-300 ${getUsageBarColor(vramPercentage)}`}
                          style={{ width: `${clampPercentage(vramPercentage)}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatMemory(gpu.memory.used)} / {formatMemory(gpu.memory.total)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* RAM Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  {metrics.memory.type === 'unified' ? 'Unified Memory' : 'System RAM'}
                </span>
                <span className="text-sm font-semibold">
                  {formatPercentage(metrics.memory.percentage)}
                </span>
              </div>
              {metrics.memory.breakdown ? (
                <>
                  {/* Stacked bar showing Used (red/yellow/green) + Cached (blue) */}
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${getUsageBarColor(metrics.memory.percentage)}`}
                      style={{
                        width: `${clampPercentage((metrics.memory.breakdown.used / metrics.memory.breakdown.total) * 100)}%`
                      }}
                    />
                    <div
                      className="h-full transition-all duration-300 bg-blue-500/60"
                      style={{
                        width: `${clampPercentage((metrics.memory.breakdown.cached / metrics.memory.breakdown.total) * 100)}%`
                      }}
                    />
                  </div>
                  {/* Legend and values */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div
                        className={`w-2 h-2 rounded-full ${getUsageBarColor(metrics.memory.percentage)}`}
                      />
                      <span>Used: {formatMemory(metrics.memory.breakdown.used)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                      <span>Cached: {formatMemory(metrics.memory.breakdown.cached)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      <span>Free: {formatMemory(metrics.memory.breakdown.available)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getUsageBarColor(metrics.memory.percentage)}`}
                      style={{ width: `${clampPercentage(metrics.memory.percentage)}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatMemory(metrics.memory.used)} / {formatMemory(metrics.memory.total)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
