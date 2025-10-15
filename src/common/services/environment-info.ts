import * as fs from 'fs'
import * as path from 'path'
import { logger } from '@/main/utils/logger'
import { PythonService } from './python/python-service'
import { UvService } from './uv/uv-service'
import { GtnService } from './gtn/gtn-service'
import { getUvToolDir, getPythonInstallDir } from '../config/paths'

export interface EnvironmentInfo {
  build: {
    version: string
    commitHash: string
    commitDate: string
    branch: string
    buildDate: string
    buildId: string
  }
  python: {
    version: string
    executable: string
    installedPackages?: string[]
  }
  griptapeNodes: {
    path: string
    version: string
    installed: boolean
  }
  uv: {
    version: string
    toolDir: string
    pythonInstallDir: string
  }
  system: {
    platform: string
    arch: string
    nodeVersion: string
    electronVersion: string
  }
  collectedAt: string
  errors: string[]
}

export class EnvironmentInfoService {
  private envInfoFile: string

  constructor(private userDataPath: string) {
    this.envInfoFile = path.join(this.userDataPath, 'environment-info.json')
  }

  /**
   * Collect environment information from all services
   */
  async collectEnvironmentInfo(
    services: {
      pythonService: PythonService
      uvService: UvService
      gtnService: GtnService
    },
    buildInfo: {
      version: string
      commitHash: string
      commitDate: string
      branch: string
      buildDate: string
      buildId: string
    }
  ): Promise<EnvironmentInfo> {
    const errors: string[] = []
    const collectedAt = new Date().toISOString()

    // Collect Python information
    let pythonVersion = 'Unknown'
    let pythonExecutable = 'Unknown'
    let installedPackages: string[] = []

    try {
      await services.pythonService.waitForReady()
      pythonVersion = await services.pythonService.getPythonVersion()
      pythonExecutable = await services.pythonService.getPythonExecutablePath()
      installedPackages = await services.pythonService.getInstalledPackages()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Python: ${message}`)
      logger.error('Failed to collect Python info:', error)
    }

    // Collect UV information
    let uvVersion = 'Unknown'
    const uvToolDir = getUvToolDir(this.userDataPath)
    const pythonInstallDir = getPythonInstallDir(this.userDataPath)

    try {
      await services.uvService.waitForReady()
      uvVersion = await services.uvService.getUvVersion()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`UV: ${message}`)
      logger.error('Failed to collect UV info:', error)
    }

    // Collect Griptape Nodes information
    let gtnInstalled = false
    let gtnVersion = 'Unknown'
    let gtnPath = 'Unknown'

    try {
      await services.gtnService.waitForReady()
      gtnInstalled = services.gtnService.gtnExecutableExists()
      if (gtnInstalled) {
        gtnPath = await services.gtnService.getGtnExecutablePath()
        gtnVersion = (await services.gtnService.getGtnVersion()).trim()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Griptape Nodes: ${message}`)
      logger.error('Failed to collect GTN info:', error)
    }

    // Collect system information
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron || 'Unknown'
    }

    const envInfo: EnvironmentInfo = {
      build: buildInfo,
      python: {
        version: pythonVersion,
        executable: pythonExecutable,
        installedPackages
      },
      griptapeNodes: {
        path: gtnPath,
        version: gtnVersion,
        installed: gtnInstalled
      },
      uv: {
        version: uvVersion,
        toolDir: uvToolDir,
        pythonInstallDir
      },
      system: systemInfo,
      collectedAt,
      errors
    }

    // Save the collected information
    this.saveEnvironmentInfo(envInfo)

    logger.info('Environment info collected successfully')
    return envInfo
  }

  /**
   * Save environment info to persistent storage
   */
  saveEnvironmentInfo(info: EnvironmentInfo): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true })
      }

      // Write environment info to file
      fs.writeFileSync(this.envInfoFile, JSON.stringify(info, null, 2))
      logger.info('Environment info saved to:', this.envInfoFile)
    } catch (error) {
      logger.error('Failed to save environment info:', error)
      throw error
    }
  }

  /**
   * Load environment info from persistent storage
   */
  loadEnvironmentInfo(): EnvironmentInfo | null {
    try {
      if (fs.existsSync(this.envInfoFile)) {
        const data = fs.readFileSync(this.envInfoFile, 'utf8')
        return JSON.parse(data) as EnvironmentInfo
      }
      return null
    } catch (error) {
      logger.error('Failed to load environment info:', error)
      return null
    }
  }

  /**
   * Check if environment info exists
   */
  hasEnvironmentInfo(): boolean {
    return fs.existsSync(this.envInfoFile)
  }

  /**
   * Clear environment info (useful for forcing re-collection)
   */
  clearEnvironmentInfo(): void {
    try {
      if (fs.existsSync(this.envInfoFile)) {
        fs.unlinkSync(this.envInfoFile)
        logger.info('Environment info cleared')
      }
    } catch (error) {
      logger.error('Failed to clear environment info:', error)
    }
  }
}
