import { EventEmitter } from 'events'
import { app } from 'electron'
import * as os from 'os'
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
  private previousCpuTimes: { total: number; idle: number } | null = null
  // Cache nvidia-smi path: undefined = not checked yet, null = not found, string = found path
  private nvidiaSmiPath: string | null | undefined = undefined

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
      // Get CPU model from Node.js os module
      const cpus = os.cpus()
      if (cpus.length > 0) {
        this.cpuModel = cpus[0].model
        logger.info(`SystemMonitorService: CPU model: ${this.cpuModel}`)
      }

      // Get GPU info from Electron app.getGPUInfo()
      const gpuInfo: any = await app.getGPUInfo('basic')
      if (gpuInfo.gpuDevice && gpuInfo.gpuDevice.length > 0) {
        this.gpuModels = gpuInfo.gpuDevice.map((device: any) => {
          // Construct a readable name from vendor and device IDs
          return `GPU (Vendor: ${device.vendorId}, Device: ${device.deviceId})`
        })
        logger.info(`SystemMonitorService: Found ${gpuInfo.gpuDevice.length} GPU(s)`)
      } else {
        this.gpuModels = []
        logger.info('SystemMonitorService: No GPUs detected')
      }
    } catch (err) {
      logger.error('SystemMonitorService: Failed to load static info:', err)
    }
  }

  private async findNvidiaSmi(): Promise<string | null> {
    try {
      logger.debug('SystemMonitorService: Searching for nvidia-smi executable')
      const whereCommand = process.platform === 'win32' ? 'where' : 'which'
      const { stdout } = await execFileAsync(whereCommand, ['nvidia-smi'])
      const foundPath = stdout.trim().split('\n')[0]
      logger.info(`SystemMonitorService: Found nvidia-smi at: ${foundPath}`)
      return foundPath
    } catch (_err) {
      logger.info(
        'SystemMonitorService: nvidia-smi not found in PATH, GPU metrics will be unavailable'
      )
      return null
    }
  }

  private async getNvidiaSmiMetrics(): Promise<
    Array<{
      utilization: number
      memoryUsed: number
      memoryTotal: number
    }>
  > {
    // If we've already determined nvidia-smi is not available, skip immediately
    if (this.nvidiaSmiPath === null) {
      return []
    }

    // If we haven't checked for nvidia-smi yet, find it and cache the result
    if (this.nvidiaSmiPath === undefined) {
      this.nvidiaSmiPath = await this.findNvidiaSmi()
      if (this.nvidiaSmiPath === null) {
        return []
      }
    }

    try {
      logger.debug(`SystemMonitorService: Executing nvidia-smi command at: ${this.nvidiaSmiPath}`)
      // Use the cached full path to nvidia-smi
      const { stdout } = await execFileAsync(this.nvidiaSmiPath, [
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
      logger.warn('SystemMonitorService: nvidia-smi execution failed:', err)
      // Cache the failure to prevent future attempts
      this.nvidiaSmiPath = null
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

  private calculateCpuUsage(): number {
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times]
      }
      totalIdle += cpu.times.idle
    })

    const currentTimes = { total: totalTick, idle: totalIdle }

    if (this.previousCpuTimes === null) {
      // First call, save times and return 0
      this.previousCpuTimes = currentTimes
      return 0
    }

    const totalDiff = currentTimes.total - this.previousCpuTimes.total
    const idleDiff = currentTimes.idle - this.previousCpuTimes.idle

    // Update previous times for next call
    this.previousCpuTimes = currentTimes

    // Calculate usage percentage
    const usage = 100 - (100 * idleDiff) / totalDiff
    return Math.max(0, Math.min(100, usage)) // Clamp between 0-100
  }

  async getMetrics(): Promise<SystemMetrics> {
    try {
      // Get CPU usage using Node.js os module
      const cpuUsage = this.calculateCpuUsage()

      // Get memory info using Node.js os module
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = totalMem - freeMem

      const memUsedGB = usedMem / (1024 * 1024 * 1024)
      const memTotalGB = totalMem / (1024 * 1024 * 1024)
      const memPercentage = (usedMem / totalMem) * 100

      // Create GPU info array with static data
      const gpuInfos: SystemMetrics['gpus'] = this.gpuModels.map((model) => ({
        model,
        usage: -1, // Will be updated by nvidia-smi if available
        memory: {
          used: -1, // Will be updated by nvidia-smi if available
          total: -1 // Will be updated by nvidia-smi if available
        }
      }))

      // Try to get real-time GPU metrics from nvidia-smi
      if (gpuInfos.length > 0) {
        const nvidiaSmiMetrics = await this.getNvidiaSmiMetrics()
        if (nvidiaSmiMetrics.length > 0) {
          // Match nvidia-smi results to GPUs by index
          nvidiaSmiMetrics.forEach((smiMetric, index) => {
            if (index < gpuInfos.length) {
              gpuInfos[index].usage = smiMetric.utilization
              gpuInfos[index].memory.used = smiMetric.memoryUsed
              gpuInfos[index].memory.total = smiMetric.memoryTotal
            }
          })
          logger.debug(
            `SystemMonitorService: Updated ${nvidiaSmiMetrics.length} GPU(s) with nvidia-smi data`
          )
        }
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
