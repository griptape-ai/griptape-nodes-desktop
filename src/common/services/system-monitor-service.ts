import { EventEmitter } from 'events'
import { app } from 'electron'
import * as os from 'os'
import * as fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { logger } from '@/main/utils/logger'

const execFileAsync = promisify(execFile)
const readFileAsync = promisify(fs.readFile)

export interface MemoryBreakdown {
  used: number // Actually used by applications (in GB)
  cached: number // Disk cache/buffers that can be reclaimed (in GB)
  available: number // Memory available for applications (in GB)
  total: number // Total physical memory (in GB)
}

export interface SystemMetrics {
  cpu: {
    usage: number // 0-100 percentage
    model: string
  }
  memory: {
    used: number // in GB - app memory usage (excludes cache)
    total: number // in GB
    percentage: number // 0-100 - percentage of actually used memory
    type: 'system' | 'unified' // 'unified' for Apple Silicon
    breakdown?: MemoryBreakdown // Detailed breakdown when available
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
  // Whether system has unified memory (Apple Silicon)
  private hasUnifiedMemory = false

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

        // Detect Apple Silicon (unified memory architecture)
        // Apple Silicon CPUs contain "Apple" in the model name
        this.hasUnifiedMemory =
          process.platform === 'darwin' && this.cpuModel.toLowerCase().includes('apple')
        if (this.hasUnifiedMemory) {
          logger.info('SystemMonitorService: Detected unified memory architecture (Apple Silicon)')
        }
      }

      // Try to get GPU names from nvidia-smi first (most accurate for NVIDIA GPUs)
      const nvidiaGpuNames = await this.getNvidiaGpuNames()
      if (nvidiaGpuNames.length > 0) {
        this.gpuModels = nvidiaGpuNames
        logger.info(
          `SystemMonitorService: Found ${nvidiaGpuNames.length} NVIDIA GPU(s) via nvidia-smi`,
        )
      } else {
        // Fall back to Electron app.getGPUInfo() for non-NVIDIA GPUs
        const gpuInfo: any = await app.getGPUInfo('basic')
        if (gpuInfo.gpuDevice && gpuInfo.gpuDevice.length > 0) {
          // Filter to prefer discrete GPUs over integrated (e.g., show NVIDIA instead of Intel)
          const filteredDevices = this.filterGpuDevices(gpuInfo.gpuDevice)
          this.gpuModels = filteredDevices.map((device: any) => {
            // Try to construct a readable name from vendor and device IDs
            const vendorName = this.getVendorName(device.vendorId)
            if (vendorName) {
              return `${vendorName} GPU`
            }
            return `GPU (Vendor: ${device.vendorId}, Device: ${device.deviceId})`
          })
          logger.info(
            `SystemMonitorService: Found ${gpuInfo.gpuDevice.length} GPU(s) via Electron, using ${filteredDevices.length} (filtered)`,
          )
        } else {
          this.gpuModels = []
          logger.info('SystemMonitorService: No GPUs detected')
        }
      }
    } catch (err) {
      logger.error('SystemMonitorService: Failed to load static info:', err)
    }
  }

  private getVendorName(vendorId: number): string | null {
    // Common GPU vendor IDs
    const vendors: Record<number, string> = {
      0x10de: 'NVIDIA',
      0x1002: 'AMD',
      0x8086: 'Intel',
      0x106b: 'Apple',
    }
    return vendors[vendorId] || null
  }

  private isDiscreteGpu(vendorId: number): boolean {
    // NVIDIA (0x10de) and AMD (0x1002) are discrete GPU vendors
    // Intel (0x8086) is typically integrated graphics
    return vendorId === 0x10de || vendorId === 0x1002
  }

  private filterGpuDevices(devices: any[]): any[] {
    // If we have both discrete and integrated GPUs, prefer discrete
    const discreteGpus = devices.filter((d) => this.isDiscreteGpu(d.vendorId))
    const integratedGpus = devices.filter(
      (d) => d.vendorId === 0x8086, // Intel integrated
    )

    // If we have discrete GPUs, use only those
    if (discreteGpus.length > 0) {
      return discreteGpus
    }

    // If we only have integrated GPUs, use those
    if (integratedGpus.length > 0) {
      return integratedGpus
    }

    // Otherwise return all (could be Apple or unknown vendors)
    return devices
  }

  private async getNvidiaGpuNames(): Promise<string[]> {
    // Find nvidia-smi if not already cached
    if (this.nvidiaSmiPath === undefined) {
      this.nvidiaSmiPath = await this.findNvidiaSmi()
    }

    if (this.nvidiaSmiPath === null) {
      return []
    }

    try {
      const { stdout } = await execFileAsync(this.nvidiaSmiPath, [
        '--query-gpu=name',
        '--format=csv,noheader,nounits',
      ])

      const names = stdout
        .trim()
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name.length > 0)

      logger.info(`SystemMonitorService: nvidia-smi GPU names: ${names.join(', ')}`)
      return names
    } catch (err) {
      logger.warn('SystemMonitorService: Failed to get GPU names from nvidia-smi:', err)
      return []
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
        'SystemMonitorService: nvidia-smi not found in PATH, GPU metrics will be unavailable',
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
        '--format=csv,noheader,nounits',
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
          memoryTotal: isNaN(memoryTotal) ? -1 : memoryTotal / 1024, // Convert MB to GB
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

  private async getDetailedMemoryInfo(): Promise<MemoryBreakdown | null> {
    const totalMem = os.totalmem()
    const totalGB = totalMem / (1024 * 1024 * 1024)

    try {
      if (process.platform === 'linux') {
        // Read /proc/meminfo for detailed Linux memory info
        const meminfo = await readFileAsync('/proc/meminfo', 'utf8')
        const lines = meminfo.split('\n')
        const values: Record<string, number> = {}

        for (const line of lines) {
          const match = line.match(/^(\w+):\s+(\d+)\s+kB/)
          if (match) {
            values[match[1]] = parseInt(match[2], 10) * 1024 // Convert kB to bytes
          }
        }

        // Linux memory model from /proc/meminfo:
        // - MemTotal: total physical RAM
        // - MemAvailable: kernel estimate of available memory (most accurate, Linux 3.14+)
        // - MemFree: completely unused memory
        // - Buffers: buffer cache for block devices
        // - Cached: page cache (file system cache)
        // - SReclaimable: reclaimable kernel slab memory
        //
        // Use MemAvailable if present (preferred), otherwise calculate from components
        const memAvailable = values['MemAvailable'] || 0
        const memFree = values['MemFree'] || 0
        const cached =
          (values['Cached'] || 0) + (values['Buffers'] || 0) + (values['SReclaimable'] || 0)

        // If MemAvailable is present, use it for more accurate calculation
        // Otherwise fall back to the component-based calculation
        const available = memAvailable > 0 ? memAvailable : memFree + cached
        const used = Math.max(0, totalMem - available) // Ensure non-negative

        return {
          used: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10,
          cached: Math.round((cached / (1024 * 1024 * 1024)) * 10) / 10,
          available: Math.round((available / (1024 * 1024 * 1024)) * 10) / 10,
          total: Math.round(totalGB * 10) / 10,
        }
      } else if (process.platform === 'darwin') {
        // Use vm_stat for macOS memory breakdown
        const { stdout } = await execFileAsync('vm_stat')

        // Parse page size from first line: "Mach Virtual Memory Statistics: (page size of 16384 bytes)"
        const pageSizeMatch = stdout.match(/page size of (\d+) bytes/)
        const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384

        // Parse vm_stat output
        const parseValue = (pattern: RegExp): number => {
          const match = stdout.match(pattern)
          return match ? parseInt(match[1], 10) * pageSize : 0
        }

        const free = parseValue(/Pages free:\s+(\d+)/)
        const active = parseValue(/Pages active:\s+(\d+)/)
        const inactive = parseValue(/Pages inactive:\s+(\d+)/)
        const speculative = parseValue(/Pages speculative:\s+(\d+)/)
        const wired = parseValue(/Pages wired down:\s+(\d+)/)
        const compressed = parseValue(/Pages occupied by compressor:\s+(\d+)/)

        // macOS memory model:
        // - Wired: locked in RAM, can't be paged out
        // - Active: recently used, in RAM
        // - Inactive: not recently used, cached but reclaimable
        // - Compressed: compressed to save space
        // - Free: not used
        // - Speculative: speculatively loaded, easily reclaimable
        // - Purgeable: can be purged immediately if needed (subset of inactive)

        // "Used" = wired + active + compressed (memory apps are actively using)
        // "Cached" = inactive (reclaimable file cache)
        // "Available" = free + speculative + inactive (all memory that can be given to apps)
        // Note: cached is a subset of available, which is correct - cached memory IS available
        const used = Math.max(0, wired + active + compressed)
        const cached = Math.max(0, inactive) // Don't add purgeable (often overlaps with inactive)
        const available = Math.max(0, free + speculative + inactive) // Include reclaimable cache

        return {
          used: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10,
          cached: Math.round((cached / (1024 * 1024 * 1024)) * 10) / 10,
          available: Math.round((available / (1024 * 1024 * 1024)) * 10) / 10,
          total: Math.round(totalGB * 10) / 10,
        }
      } else if (process.platform === 'win32') {
        // Use PowerShell to get all memory values from a single, consistent source
        // This avoids ambiguity about what WMI's FreePhysicalMemory actually represents
        try {
          const { stdout } = await execFileAsync('powershell', [
            '-NoProfile',
            '-Command',
            `
            $counters = Get-Counter -Counter @(
              '\\Memory\\Available Bytes',
              '\\Memory\\Standby Cache Normal Priority Bytes',
              '\\Memory\\Standby Cache Reserve Bytes',
              '\\Memory\\Standby Cache Core Bytes'
            ) -ErrorAction SilentlyContinue
            $available = ($counters.CounterSamples | Where-Object { $_.Path -like '*Available Bytes' }).CookedValue
            $standbyNormal = ($counters.CounterSamples | Where-Object { $_.Path -like '*Normal Priority*' }).CookedValue
            $standbyReserve = ($counters.CounterSamples | Where-Object { $_.Path -like '*Reserve*' }).CookedValue
            $standbyCore = ($counters.CounterSamples | Where-Object { $_.Path -like '*Core*' }).CookedValue
            $total = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
            "$available,$($standbyNormal + $standbyReserve + $standbyCore),$total"
            `.trim(),
          ])

          const parts = stdout.trim().split(',')
          if (parts.length >= 3) {
            // Windows memory model (from performance counters):
            // - Available Bytes = Standby + Free (memory that can be immediately used)
            // - Standby Cache = File cache that can be reclaimed
            // - In Use = Total - Available
            const availableMem = parseFloat(parts[0]) || 0
            const cached = parseFloat(parts[1]) || 0
            const totalMemPS = parseFloat(parts[2]) || totalMem

            // "In Use" is memory that is NOT available
            const used = Math.max(0, totalMemPS - availableMem)

            return {
              used: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10,
              cached: Math.round((cached / (1024 * 1024 * 1024)) * 10) / 10,
              available: Math.round((availableMem / (1024 * 1024 * 1024)) * 10) / 10,
              total: Math.round((totalMemPS / (1024 * 1024 * 1024)) * 10) / 10,
            }
          }
        } catch (err) {
          logger.debug('SystemMonitorService: PowerShell memory query failed:', err)
        }

        // Fall back to Node.js os module if PowerShell fails
        const freeMem = os.freemem()
        const used = Math.max(0, totalMem - freeMem)
        return {
          used: Math.round((used / (1024 * 1024 * 1024)) * 10) / 10,
          cached: 0,
          available: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
          total: Math.round(totalGB * 10) / 10,
        }
      }
    } catch (err) {
      logger.debug('SystemMonitorService: Failed to get detailed memory info:', err)
    }

    return null
  }

  async getMetrics(): Promise<SystemMetrics> {
    try {
      // Get CPU usage using Node.js os module
      const cpuUsage = this.calculateCpuUsage()

      // Try to get detailed memory breakdown
      const memoryBreakdown = await this.getDetailedMemoryInfo()

      // Fall back to basic memory info if detailed is unavailable
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const basicUsedMem = Math.max(0, totalMem - freeMem) // Ensure non-negative

      // Use detailed breakdown values if available, otherwise fall back to basic
      const memUsedGB = Math.max(0, memoryBreakdown?.used ?? basicUsedMem / (1024 * 1024 * 1024))
      const memTotalGB = memoryBreakdown?.total ?? totalMem / (1024 * 1024 * 1024)
      const memPercentage = (memUsedGB / memTotalGB) * 100

      // Create GPU info array with static data
      let gpuInfos: SystemMetrics['gpus'] = this.gpuModels.map((model) => ({
        model,
        usage: -1, // Will be updated by nvidia-smi if available
        memory: {
          used: -1, // Will be updated by nvidia-smi if available
          total: -1, // Will be updated by nvidia-smi if available
        },
      }))

      // Try to get real-time GPU metrics from nvidia-smi
      // This also handles the case where nvidia-smi finds GPUs that app.getGPUInfo() missed
      const nvidiaSmiMetrics = await this.getNvidiaSmiMetrics()
      if (nvidiaSmiMetrics.length > 0) {
        // If we have more GPUs from nvidia-smi than from initial detection,
        // the nvidia-smi data is more authoritative - use it to rebuild GPU list
        if (nvidiaSmiMetrics.length > gpuInfos.length) {
          // Re-fetch GPU names to ensure we have the right count
          const nvidiaNames = await this.getNvidiaGpuNames()
          if (nvidiaNames.length === nvidiaSmiMetrics.length) {
            gpuInfos = nvidiaNames.map((name) => ({
              model: name,
              usage: -1,
              memory: { used: -1, total: -1 },
            }))
            // Update our cached models for future calls
            this.gpuModels = nvidiaNames
          }
        }

        // Match nvidia-smi results to GPUs by index
        nvidiaSmiMetrics.forEach((smiMetric, index) => {
          if (index < gpuInfos.length) {
            gpuInfos[index].usage = smiMetric.utilization
            gpuInfos[index].memory.used = smiMetric.memoryUsed
            gpuInfos[index].memory.total = smiMetric.memoryTotal
          }
        })
        logger.debug(
          `SystemMonitorService: Updated ${nvidiaSmiMetrics.length} GPU(s) with nvidia-smi data`,
        )
      }

      return {
        cpu: {
          usage: Math.round(cpuUsage * 10) / 10, // Round to 1 decimal
          model: this.cpuModel,
        },
        memory: {
          used: Math.round(memUsedGB * 10) / 10,
          total: Math.round(memTotalGB * 10) / 10,
          percentage: Math.round(memPercentage * 10) / 10,
          type: this.hasUnifiedMemory ? 'unified' : 'system',
          breakdown: memoryBreakdown ?? undefined,
        },
        gpus: gpuInfos,
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
