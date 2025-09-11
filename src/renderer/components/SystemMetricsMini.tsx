import React, { useState, useEffect, useCallback } from 'react';
import { SystemMetrics } from '../../common/types/global';
import { Cpu, HardDrive, Monitor, Activity } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';

interface SystemMetricsMiniProps {
  className?: string;
}

export function SystemMetricsMini({ className = "" }: SystemMetricsMiniProps) {
  const [latestMetrics, setLatestMetrics] = useState<SystemMetrics | null>(null);
  const [recentHistory, setRecentHistory] = useState<SystemMetrics[]>([]);

  // Handle real-time metrics updates
  const handleMetricsUpdate = useCallback((event: any, metrics: SystemMetrics) => {
    setLatestMetrics(metrics);
    setRecentHistory(prev => {
      const updated = [...prev, metrics];
      // Keep only last 20 data points for mini sparklines
      return updated.length > 20 ? updated.slice(-20) : updated;
    });
  }, []);

  const handleMetricsError = useCallback((event: any, error: string) => {
    console.error('Mini metrics error:', error);
  }, []);

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        const [latest, recent] = await Promise.all([
          window.metricsAPI.getLatest(),
          window.metricsAPI.getRecent(20)
        ]);
        
        if (latest) setLatestMetrics(latest);
        setRecentHistory(recent || []);
      } catch (error) {
        console.error('Failed to load mini metrics:', error);
      }
    };

    loadData();

    // Subscribe to real-time updates
    window.metricsAPI.onMetricsUpdate(handleMetricsUpdate);
    window.metricsAPI.onMetricsError(handleMetricsError);

    return () => {
      window.metricsAPI.removeMetricsUpdate(handleMetricsUpdate);
      window.metricsAPI.removeMetricsError(handleMetricsError);
    };
  }, [handleMetricsUpdate, handleMetricsError]);

  // Create mini sparkline bars
  const createSparklineBars = (values: number[], color: string) => {
    if (values.length === 0) return null;
    
    const maxValue = Math.max(...values);
    const normalizedValues = values.map(v => (v / Math.max(maxValue, 1)) * 100);
    
    return (
      <div className="flex items-end gap-[1px] h-4 min-w-[40px]">
        {normalizedValues.map((value, index) => (
          <div
            key={index}
            className={`w-[2px] rounded-t-[1px]`}
            style={{
              height: `${Math.max(value, 2)}%`,
              backgroundColor: color,
              opacity: 0.7 + (index / values.length) * 0.3 // Fade effect for recent data
            }}
          />
        ))}
      </div>
    );
  };

  if (!latestMetrics) {
    return (
      <div className={`bg-muted/30 rounded-md p-2 ${className}`}>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-muted-foreground animate-pulse" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  const cpuValues = recentHistory.map(m => m.cpu.usage);
  const memoryValues = recentHistory.map(m => m.memory.usage);
  const primaryGpu = latestMetrics.gpu.controllers[0];
  const gpuValues = recentHistory.map(m => m.gpu.controllers[0]?.usage || 0).filter(v => v > 0);

  return (
    <div className={`bg-muted/30 rounded-md p-2 space-y-1 ${className}`}>
      {/* CPU */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Cpu className="w-3 h-3 text-blue-500 flex-shrink-0 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <div>
                <p className="font-medium">CPU Usage</p>
                <p className="text-xs opacity-80">Current processor utilization</p>
                {latestMetrics.cpu.temperature && (
                  <p className="text-xs opacity-80">Temp: {Math.round(latestMetrics.cpu.temperature)}°C</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          <span className="text-xs font-medium text-blue-500 truncate">
            {latestMetrics.cpu.usage.toFixed(0)}%
          </span>
        </div>
        {createSparklineBars(cpuValues, '#3b82f6')}
      </div>

      {/* Memory */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <HardDrive className="w-3 h-3 text-green-500 flex-shrink-0 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <div>
                <p className="font-medium">Memory Usage</p>
                <p className="text-xs opacity-80">System RAM utilization</p>
                <p className="text-xs opacity-80">
                  {(latestMetrics.memory.used / (1024**3)).toFixed(1)}GB / {(latestMetrics.memory.total / (1024**3)).toFixed(1)}GB
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
          <span className="text-xs font-medium text-green-500 truncate">
            {latestMetrics.memory.usage.toFixed(0)}%
          </span>
        </div>
        {createSparklineBars(memoryValues, '#22c55e')}
      </div>

      {/* GPU (only if available) */}
      {primaryGpu && primaryGpu.usage !== undefined && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Monitor className="w-3 h-3 text-purple-500 flex-shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <p className="font-medium">GPU Usage</p>
                  <p className="text-xs opacity-80">Graphics processor utilization</p>
                  <p className="text-xs opacity-80">{primaryGpu.model}</p>
                </div>
              </TooltipContent>
            </Tooltip>
            <span className="text-xs font-medium text-purple-500 truncate">
              {primaryGpu.usage.toFixed(0)}%
            </span>
          </div>
          {gpuValues.length > 0 && createSparklineBars(gpuValues, '#a855f7')}
        </div>
      )}

      {/* VRAM (only if available) */}
      {primaryGpu && primaryGpu.memoryUsed && primaryGpu.vram && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Monitor className="w-3 h-3 text-orange-500 flex-shrink-0 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  <p className="font-medium">VRAM Usage</p>
                  <p className="text-xs opacity-80">Video memory utilization</p>
                  <p className="text-xs opacity-80">
                    {primaryGpu.memoryUsed}MB / {primaryGpu.vram}MB
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
            <span className="text-xs font-medium text-orange-500 truncate">
              {Math.round((primaryGpu.memoryUsed / primaryGpu.vram) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}