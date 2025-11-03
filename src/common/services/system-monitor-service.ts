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

  private isDiscreteGpu(gpu: si.Systeminformation.GraphicsControllerData): boolean {
    // Filter out integrated graphics, focusing on clear indicators
    const model = (gpu.model || '').toLowerCase()

    // 1. Exclude clearly integrated Intel graphics patterns
    const integratedPatterns = [
      'intel hd',
      'intel uhd',
      'intel iris',
      'intel(r) hd',
      'intel(r) uhd',
      'intel(r) iris'
    ]
    if (integratedPatterns.some((pattern) => model.includes(pattern))) {
      return false
    }

    // 2. Include GPUs from known discrete GPU vendors
    // NVIDIA and AMD cards are typically discrete (especially for compute workloads)
    const discreteVendorPatterns = [
      'nvidia',
      'geforce',
      'quadro',
      'tesla',
      'amd',
      'radeon',
      'rx ',
      'vega'
    ]
    if (discreteVendorPatterns.some((pattern) => model.includes(pattern))) {
      return true
    }

    // 3. Check bus type - exclude onboard (integrated)
    if (gpu.bus && gpu.bus.toLowerCase() === 'onboard') {
      return false
    }

    // 4. If it has dedicated VRAM (not dynamic), likely discrete
    if (gpu.vram && gpu.vram > 0 && gpu.vramDynamic !== true) {
      return true
    }

    // Default to excluding unknown GPUs to be safe
    return false
  }

  private async loadStaticInfo() {
    try {
      const cpu = await si.cpu()
      this.cpuModel = cpu.manufacturer && cpu.brand ? `${cpu.manufacturer} ${cpu.brand}` : 'Unknown'

      const graphics = await si.graphics()
      if (graphics.controllers && graphics.controllers.length > 0) {
        // Filter to only discrete GPUs
        const discreteGpus = graphics.controllers.filter((gpu) => this.isDiscreteGpu(gpu))
        this.gpuModels = discreteGpus.map((gpu) => gpu.model || 'Unknown')
        logger.info(
          `SystemMonitorService: Found ${discreteGpus.length} discrete GPU(s) out of ${graphics.controllers.length} total`
        )
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
      logger.debug('SystemMonitorService: Executing nvidia-smi command')
      // Try to execute nvidia-smi with query format
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=utilization.gpu,memory.used,memory.total',
        '--format=csv,noheader,nounits'
      ])

      logger.debug('SystemMonitorService: nvidia-smi output:', stdout)

      const lines = stdout.trim().split('\n')
      return lines.map((line) => {
        const [utilization, memoryUsed, memoryTotal] = line
          .split(',')
          .map((v) => parseFloat(v.trim()))
        return {
          utilization: isNaN(utilization) ? -1 : utilization,
          memoryUsed: isNaN(memoryUsed) ? -1 : memoryUsed / 1024, // Convert MB to GB
          memoryTotal: isNaN(memoryTotal) ? -1 : memoryTotal / 1024 // Convert MB to GB
        }
      })
    } catch (err) {
      logger.warn('SystemMonitorService: nvidia-smi failed:', err)
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

      // Get GPU info for discrete GPUs only
      const gpuInfos: SystemMetrics['gpus'] = []
      try {
        const graphics = await si.graphics()
        logger.debug(
          'SystemMonitorService: graphics.controllers:',
          graphics.controllers?.length || 0
        )

        if (graphics.controllers && graphics.controllers.length > 0) {
          // Filter to only discrete GPUs
          const discreteGpus = graphics.controllers.filter((gpu) => this.isDiscreteGpu(gpu))
          logger.debug(
            `SystemMonitorService: Processing ${discreteGpus.length} discrete GPU(s) out of ${graphics.controllers.length} total`
          )

          // First, try to get metrics from systeminformation
          discreteGpus.forEach((gpu, index) => {
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

            logger.debug(
              `SystemMonitorService: GPU ${index} (${gpu.model}): usage=${gpuUsage}, memUsed=${memUsed}, memTotal=${memTotal}`
            )

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
          logger.debug(
            `SystemMonitorService: hasUnavailableMetrics=${hasUnavailableMetrics}, platform=${process.platform}`
          )

          if (hasUnavailableMetrics && process.platform === 'win32') {
            logger.info('SystemMonitorService: Attempting nvidia-smi fallback for GPU metrics')
            const nvidiaSmiMetrics = await this.getNvidiaSmiMetrics()
            logger.debug(
              `SystemMonitorService: nvidia-smi returned ${nvidiaSmiMetrics.length} GPUs`
            )

            if (nvidiaSmiMetrics.length > 0) {
              // nvidia-smi only reports NVIDIA GPUs, but systeminformation reports all GPUs
              // Find NVIDIA GPUs and match them with nvidia-smi data
              let nvidiaIndex = 0
              gpuInfos.forEach((gpuInfo, index) => {
                // Check if this is an NVIDIA GPU by model name
                const isNvidiaGpu = gpuInfo.model.toLowerCase().includes('nvidia')

                if (isNvidiaGpu && nvidiaIndex < nvidiaSmiMetrics.length) {
                  const smiMetric = nvidiaSmiMetrics[nvidiaIndex]
                  logger.debug(
                    `SystemMonitorService: Matching GPU ${index} (${gpuInfo.model}) with nvidia-smi GPU ${nvidiaIndex}`
                  )
                  logger.debug(
                    `SystemMonitorService: nvidia-smi data: utilization=${smiMetric.utilization}, memUsed=${smiMetric.memoryUsed}, memTotal=${smiMetric.memoryTotal}`
                  )

                  // Only override if systeminformation data was unavailable
                  if (gpuInfo.usage === -1) {
                    gpuInfo.usage = smiMetric.utilization
                    logger.debug(
                      `SystemMonitorService: Updated GPU ${index} usage to ${smiMetric.utilization}`
                    )
                  }
                  if (gpuInfo.memory.used === -1) {
                    gpuInfo.memory.used = smiMetric.memoryUsed
                  }
                  if (gpuInfo.memory.total === -1) {
                    gpuInfo.memory.total = smiMetric.memoryTotal
                  }

                  nvidiaIndex++
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
