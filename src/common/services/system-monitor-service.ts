import { EventEmitter } from 'events'
import * as si from 'systeminformation'
import { logger } from '@/main/utils/logger'

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
  gpu: {
    model: string
    usage: number // 0-100 percentage, -1 if unavailable
    memory: {
      used: number // in GB, -1 if unavailable
      total: number // in GB, -1 if unavailable
    }
  } | null
}

export class SystemMonitorService extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null
  private isMonitoring = false
  private cpuModel = 'Unknown'
  private gpuModel = 'Unknown'

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
        // Get primary GPU (usually the first one)
        const primaryGpu = graphics.controllers[0]
        this.gpuModel = primaryGpu.model || 'Unknown'
      }
    } catch (err) {
      logger.error('SystemMonitorService: Failed to load static info:', err)
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
    this.getMetrics().then((metrics) => {
      this.emit('metrics-update', metrics)
    }).catch((err) => {
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

      // Get GPU info
      let gpuInfo: SystemMetrics['gpu'] = null
      try {
        const graphics = await si.graphics()
        if (graphics.controllers && graphics.controllers.length > 0) {
          const primaryGpu = graphics.controllers[0]

          // GPU utilization might not be available on all platforms
          const gpuUsage = primaryGpu.utilizationGpu !== undefined && primaryGpu.utilizationGpu !== null
            ? primaryGpu.utilizationGpu
            : -1

          const memUsed = primaryGpu.memoryUsed !== undefined && primaryGpu.memoryUsed !== null
            ? primaryGpu.memoryUsed / 1024 // Convert MB to GB
            : -1

          const memTotal = primaryGpu.vram !== undefined && primaryGpu.vram !== null
            ? primaryGpu.vram / 1024 // Convert MB to GB
            : -1

          gpuInfo = {
            model: this.gpuModel,
            usage: gpuUsage,
            memory: {
              used: memUsed,
              total: memTotal
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
        gpu: gpuInfo
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
