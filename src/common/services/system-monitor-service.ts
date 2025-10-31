import { EventEmitter } from 'events'
import * as si from 'systeminformation'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/main/utils/logger'

const execFileAsync = promisify(execFile)

export interface SystemMetrics {
  cpu: {
    usage: number // 0-100 percentage
    model: string
  }
  memory: {
    used: number // in GB
    total: number // in GB
    percentage: number // 0-100
  }
  gpus: Array<{
    model: string
    usage: number // 0-100 percentage, -1 if unavailable
    memory: {
      used: number // in GB, -1 if unavailable
      total: number // in GB, -1 if unavailable
    }
  }>
}

export class SystemMonitorService extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null
  private isMonitoring = false
  private cpuModel = 'Unknown'
  private gpuModels: string[] = []

  constructor() {
    super()
  }

  async start() {
    logger.info('SystemMonitorService: Starting...')

    // Get static info once
    await this.loadStaticInfo()

    logger.info('SystemMonitorService: Started')
  }

  private async loadStaticInfo() {
    try {
      const cpu = await si.cpu()
      this.cpuModel = cpu.manufacturer && cpu.brand ? `${cpu.manufacturer} ${cpu.brand}` : 'Unknown'

      const graphics = await si.graphics()
      if (graphics.controllers && graphics.controllers.length > 0) {
        // Get all GPU models
        this.gpuModels = graphics.controllers.map((gpu) => gpu.model || 'Unknown')
      }
    } catch (err) {
      logger.error('SystemMonitorService: Failed to load static info:', err)
    }
  }

  private async getNvidiaSmiMetrics(): Promise<
    Array<{
      utilization: number
      memoryUsed: number
      memoryTotal: number
    }>
  > {
    try {
      // Try to execute nvidia-smi with query format
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=utilization.gpu,memory.used,memory.total',
        '--format=csv,noheader,nounits'
      ])

      const lines = stdout.trim().split('\n')
      return lines.map((line) => {
        const [utilization, memoryUsed, memoryTotal] = line.split(',').map((v) => parseFloat(v.trim()))
        return {
          utilization: isNaN(utilization) ? -1 : utilization,
          memoryUsed: isNaN(memoryUsed) ? -1 : memoryUsed / 1024, // Convert MB to GB
          memoryTotal: isNaN(memoryTotal) ? -1 : memoryTotal / 1024 // Convert MB to GB
        }
      })
    } catch (err) {
      logger.debug('SystemMonitorService: nvidia-smi not available:', err)
      return []
    }
  }

  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('SystemMonitorService: Already monitoring')
      return
    }

    logger.info('SystemMonitorService: Starting monitoring')
    this.isMonitoring = true

    // Start polling every 1 second
    this.intervalId = setInterval(async () => {
      try {
        const metrics = await this.getMetrics()
        this.emit('metrics-update', metrics)
      } catch (err) {
        logger.error('SystemMonitorService: Failed to get metrics:', err)
      }
    }, 1000)

    // Also emit immediately
    this.getMetrics()
      .then((metrics) => {
        this.emit('metrics-update', metrics)
      })
      .catch((err) => {
        logger.error('SystemMonitorService: Failed to get initial metrics:', err)
      })
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return
    }

    logger.info('SystemMonitorService: Stopping monitoring')
    this.isMonitoring = false

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  async getMetrics(): Promise<SystemMetrics> {
    try {
      // Get CPU usage
      const cpuLoad = await si.currentLoad()
      const cpuUsage = cpuLoad.currentLoad || 0

      // Get memory info
      const mem = await si.mem()

      // Use 'active' memory for more accurate usage across all platforms
      // 'active' represents memory actually being used by applications
      // 'used' includes buffers/cache which is reclaimable, making it misleading
      const memUsedGB = mem.active / (1024 * 1024 * 1024)
      const memTotalGB = mem.total / (1024 * 1024 * 1024)
      const memPercentage = (mem.active / mem.total) * 100

      // Get GPU info for all GPUs
      const gpuInfos: SystemMetrics['gpus'] = []
      try {
        const graphics = await si.graphics()
        if (graphics.controllers && graphics.controllers.length > 0) {
          // First, try to get metrics from systeminformation
          graphics.controllers.forEach((gpu, index) => {
            // GPU utilization might not be available on all platforms
            const gpuUsage =
              gpu.utilizationGpu !== undefined && gpu.utilizationGpu !== null
                ? gpu.utilizationGpu
                : -1

            const memUsed =
              gpu.memoryUsed !== undefined && gpu.memoryUsed !== null
                ? gpu.memoryUsed / 1024 // Convert MB to GB
                : -1

            const memTotal =
              gpu.vram !== undefined && gpu.vram !== null
                ? gpu.vram / 1024 // Convert MB to GB
                : -1

            gpuInfos.push({
              model: this.gpuModels[index] || 'Unknown',
              usage: gpuUsage,
              memory: {
                used: memUsed,
                total: memTotal
              }
            })
          })

          // If utilization is unavailable (-1) on Windows, try nvidia-smi as fallback
          const hasUnavailableMetrics = gpuInfos.some((gpu) => gpu.usage === -1)
          if (hasUnavailableMetrics && process.platform === 'win32') {
            const nvidiaSmiMetrics = await this.getNvidiaSmiMetrics()
            if (nvidiaSmiMetrics.length > 0) {
              // Update GPU metrics with nvidia-smi data
              nvidiaSmiMetrics.forEach((smiMetric, index) => {
                if (gpuInfos[index]) {
                  // Only override if systeminformation data was unavailable
                  if (gpuInfos[index].usage === -1) {
                    gpuInfos[index].usage = smiMetric.utilization
                  }
                  if (gpuInfos[index].memory.used === -1) {
                    gpuInfos[index].memory.used = smiMetric.memoryUsed
                  }
                  if (gpuInfos[index].memory.total === -1) {
                    gpuInfos[index].memory.total = smiMetric.memoryTotal
                  }
                }
              })
            }
          }
        }
      } catch (err) {
        logger.debug('SystemMonitorService: GPU info not available:', err)
      }

      return {
        cpu: {
          usage: Math.round(cpuUsage * 10) / 10, // Round to 1 decimal
          model: this.cpuModel
        },
        memory: {
          used: Math.round(memUsedGB * 10) / 10,
          total: Math.round(memTotalGB * 10) / 10,
          percentage: Math.round(memPercentage * 10) / 10
        },
        gpus: gpuInfos
      }
    } catch (err) {
      logger.error('SystemMonitorService: Failed to get metrics:', err)
      throw err
    }
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring
  }
}
