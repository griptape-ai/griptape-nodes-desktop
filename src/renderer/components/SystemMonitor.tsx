import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, MemoryStick, Gpu } from 'lucide-react'

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

export function SystemMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)

  const handleMetricsUpdate = useCallback((newMetrics: SystemMetrics) => {
    setMetrics(newMetrics)
  }, [])

  useEffect(() => {
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
  }, [handleMetricsUpdate])

  if (!metrics) {
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

  return (
    <div className="bg-card border-b border-border px-6 py-2 flex items-center gap-12 text-xs">
      {/* CPU */}
      <div className="flex items-center gap-2 flex-1">
        <Cpu className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">CPU</span>
            <span className="text-foreground font-semibold">
              {formatPercentage(metrics.cpu.usage)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getBarColor(metrics.cpu.usage)}`}
              style={{ width: `${Math.min(metrics.cpu.usage, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground truncate">{metrics.cpu.model}</div>
        </div>
      </div>

      {/* GPUs */}
      {metrics.gpus.map((gpu, index) => (
        <div key={index} className="flex items-center gap-2 flex-1">
          <Gpu className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                GPU {metrics.gpus.length > 1 ? index + 1 : ''}
              </span>
              {gpu.usage >= 0 ? (
                <span className="text-foreground font-semibold">{formatPercentage(gpu.usage)}</span>
              ) : (
                <span className="text-muted-foreground">N/A</span>
              )}
            </div>
            {gpu.usage >= 0 ? (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getBarColor(gpu.usage)}`}
                  style={{ width: `${Math.min(gpu.usage, 100)}%` }}
                />
              </div>
            ) : (
              <div className="w-full h-1.5" />
            )}
            <div className="text-[10px] text-muted-foreground truncate">{gpu.model}</div>
          </div>
        </div>
      ))}

      {/* RAM */}
      <div className="flex items-center gap-2 flex-1">
        <MemoryStick className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">RAM</span>
            <span className="text-foreground font-semibold">
              {formatPercentage(metrics.memory.percentage)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getBarColor(metrics.memory.percentage)}`}
              style={{ width: `${Math.min(metrics.memory.percentage, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground">
            {formatMemory(metrics.memory.used)} / {formatMemory(metrics.memory.total)}
          </div>
        </div>
      </div>
    </div>
  )
}
