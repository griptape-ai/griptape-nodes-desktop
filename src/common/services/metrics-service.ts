import { EventEmitter } from 'events';
import * as si from 'systeminformation';
import { logger } from '@/logger';

export interface SystemMetrics {
  cpu: {
    usage: number; // CPU usage percentage
    temperature?: number; // CPU temperature in Celsius (if available)
  };
  memory: {
    total: number; // Total system memory in bytes
    used: number; // Used memory in bytes
    free: number; // Free memory in bytes
    usage: number; // Memory usage percentage
  };
  gpu: {
    controllers: Array<{
      vendor: string;
      model: string;
      vram?: number; // VRAM in MB (if available)
      memoryUsed?: number; // VRAM used in MB (if available)
      memoryFree?: number; // VRAM free in MB (if available)
      usage?: number; // GPU usage percentage (if available)
    }>;
  };
  timestamp: Date;
}

interface Events {
  'metrics:updated': [SystemMetrics];
  'metrics:error': [Error];
}

export class MetricsService extends EventEmitter<Events> {
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private latestMetrics: SystemMetrics | null = null;
  
  // Circular buffer for history - keep last 10 minutes at 500ms intervals (1200 data points)
  private historyBuffer: SystemMetrics[] = [];
  private readonly maxHistorySize = 1200;
  private bufferIndex = 0;

  constructor(intervalMs: number = 500) { // Default 500ms for real-time feel
    super();
    this.intervalMs = intervalMs;
  }

  /**
   * Start collecting system metrics
   */
  start(): void {
    if (this.isCollecting) {
      logger.debug('MetricsService already collecting');
      return;
    }

    logger.info(`Starting system metrics collection (${this.intervalMs}ms interval)`);
    this.isCollecting = true;
    
    // Collect immediately then start interval
    this.collectMetrics();
    
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.intervalMs);
  }

  /**
   * Stop collecting system metrics
   */
  stop(): void {
    if (!this.isCollecting) {
      logger.debug('MetricsService already stopped');
      return;
    }

    logger.info('Stopping system metrics collection');
    this.isCollecting = false;
    
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  /**
   * Get the latest collected metrics
   */
  getLatestMetrics(): SystemMetrics | null {
    return this.latestMetrics;
  }

  /**
   * Get metrics history (returns chronologically ordered array)
   */
  getMetricsHistory(): SystemMetrics[] {
    if (this.historyBuffer.length < this.maxHistorySize) {
      // Buffer not full yet, return from start to current position
      return this.historyBuffer.slice(0, this.bufferIndex);
    } else {
      // Buffer is full, need to reconstruct chronological order
      const olderData = this.historyBuffer.slice(this.bufferIndex);
      const newerData = this.historyBuffer.slice(0, this.bufferIndex);
      return [...olderData, ...newerData];
    }
  }

  /**
   * Get recent metrics history (last N data points)
   */
  getRecentHistory(count: number): SystemMetrics[] {
    const history = this.getMetricsHistory();
    return history.slice(-count);
  }

  /**
   * Get current collection status
   */
  isRunning(): boolean {
    return this.isCollecting;
  }

  /**
   * Collect system metrics once
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Collect CPU, memory, and GPU data in parallel for better performance
      const [cpuCurrentLoad, memory, graphics, cpuTemp] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.graphics(),
        si.cpuTemperature().catch(() => null), // CPU temp might not be available on all systems
      ]);

      const metrics: SystemMetrics = {
        cpu: {
          usage: Math.round(cpuCurrentLoad.currentLoad * 100) / 100, // Round to 2 decimal places
          temperature: cpuTemp?.main || undefined,
        },
        memory: {
          total: memory.total,
          used: memory.used,
          free: memory.free,
          usage: Math.round((memory.used / memory.total) * 10000) / 100, // Percentage rounded to 2 decimal places
        },
        gpu: {
          controllers: graphics.controllers.map(controller => ({
            vendor: controller.vendor || 'Unknown',
            model: controller.model || 'Unknown',
            vram: controller.vram || undefined,
            memoryUsed: controller.memoryUsed || undefined,
            memoryFree: controller.memoryFree || undefined,
            usage: controller.utilizationGpu || undefined,
          })),
        },
        timestamp: new Date(),
      };

      this.latestMetrics = metrics;
      this.addToHistory(metrics);
      this.emit('metrics:updated', metrics);

      if (logger.isLevelEnabled && logger.isLevelEnabled('debug')) {
        logger.debug(`Metrics collected - CPU: ${metrics.cpu.usage.toFixed(1)}%, RAM: ${metrics.memory.usage.toFixed(1)}%, GPUs: ${metrics.gpu.controllers.length}`);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to collect system metrics:', errorObj);
      this.emit('metrics:error', errorObj);
    }
  }

  /**
   * Add metrics to circular buffer history
   */
  private addToHistory(metrics: SystemMetrics): void {
    if (this.historyBuffer.length < this.maxHistorySize) {
      // Buffer not full yet, just push
      this.historyBuffer.push(metrics);
      this.bufferIndex = this.historyBuffer.length;
    } else {
      // Buffer is full, overwrite oldest entry
      this.historyBuffer[this.bufferIndex] = metrics;
      this.bufferIndex = (this.bufferIndex + 1) % this.maxHistorySize;
    }
  }

  /**
   * Clear metrics history
   */
  clearHistory(): void {
    this.historyBuffer = [];
    this.bufferIndex = 0;
    logger.info('Metrics history cleared');
  }

  /**
   * Get history buffer stats
   */
  getHistoryStats(): { count: number; maxSize: number; memoryUsageMB: number } {
    const count = Math.min(this.historyBuffer.length, this.maxHistorySize);
    const approximateMemoryUsage = count * 200; // Rough estimate: ~200 bytes per metrics entry
    
    return {
      count,
      maxSize: this.maxHistorySize,
      memoryUsageMB: Math.round(approximateMemoryUsage / 1024 / 1024 * 100) / 100,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.latestMetrics = null;
    this.historyBuffer = [];
    this.bufferIndex = 0;
  }
}