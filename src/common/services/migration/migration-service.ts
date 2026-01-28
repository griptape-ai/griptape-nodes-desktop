import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getGtnConfigPath } from '../../config/paths'
import { logger } from '@/main/utils/logger'

export interface ConfigFileResult {
  path: string
  isValid: boolean
  workspaceDirectory?: string
  hasEnvFile: boolean
  error?: string
}

export interface ImportResult {
  success: boolean
  workspaceDirectory?: string
  envImported: boolean
  error?: string
}

export interface CopyWorkspaceResult {
  success: boolean
  filesCopied: number
  error?: string
}

// Pattern to match config file names: griptape(-|_)nodes(-|_)config.json
const CONFIG_FILE_PATTERN = /^griptape[-_]nodes[-_]config\.json$/i

// Directories to skip when scanning
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'Library',
  'AppData',
  '.Trash',
  '.cache',
  '.npm',
  '.yarn',
  'venv',
  '.venv',
  '__pycache__',
  'dist',
  'build',
  '.next',
  'target',
])

export class MigrationService {
  constructor(private userDataDir: string) {}

  /**
   * Get platform-specific default config paths where CLI stores config
   */
  private getDefaultConfigPaths(): string[] {
    const homeDir = os.homedir()

    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming')
      return [
        path.join(appData, 'griptape_nodes', 'griptape_nodes_config.json'),
        path.join(appData, 'griptape-nodes', 'griptape_nodes_config.json'),
        path.join(appData, 'griptape_nodes', 'griptape-nodes-config.json'),
        path.join(appData, 'griptape-nodes', 'griptape-nodes-config.json'),
      ]
    } else {
      // macOS and Linux - XDG_CONFIG_HOME defaults to ~/.config
      const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config')
      return [
        path.join(xdgConfig, 'griptape_nodes', 'griptape_nodes_config.json'),
        path.join(xdgConfig, 'griptape-nodes', 'griptape_nodes_config.json'),
        path.join(xdgConfig, 'griptape_nodes', 'griptape-nodes-config.json'),
        path.join(xdgConfig, 'griptape-nodes', 'griptape-nodes-config.json'),
      ]
    }
  }

  /**
   * Check default CLI config locations for existing config files
   */
  async checkDefaultLocations(): Promise<ConfigFileResult[]> {
    const results: ConfigFileResult[] = []
    const paths = this.getDefaultConfigPaths()

    for (const configPath of paths) {
      try {
        if (fs.existsSync(configPath)) {
          const result = await this.validateConfigFile(configPath)
          results.push(result)
        }
      } catch (error) {
        logger.warn(`Error checking config path ${configPath}:`, error)
      }
    }

    return results
  }

  /**
   * Scan home directory recursively for config files (fallback)
   */
  async scanHomeDirectory(maxDepth: number = 5): Promise<ConfigFileResult[]> {
    const homeDir = os.homedir()
    const results: ConfigFileResult[] = []
    const foundPaths = new Set<string>()

    const scan = async (dir: string, depth: number): Promise<void> => {
      if (depth > maxDepth) return

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            // Skip certain directories
            if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) {
              continue
            }
            await scan(fullPath, depth + 1)
          } else if (entry.isFile() && CONFIG_FILE_PATTERN.test(entry.name)) {
            if (!foundPaths.has(fullPath)) {
              foundPaths.add(fullPath)
              const result = await this.validateConfigFile(fullPath)
              results.push(result)
            }
          }
        }
      } catch (error) {
        // Ignore permission errors and continue scanning
        if ((error as NodeJS.ErrnoException).code !== 'EACCES') {
          logger.warn(`Error scanning directory ${dir}:`, error)
        }
      }
    }

    await scan(homeDir, 0)
    return results
  }

  /**
   * Validate a specific config file
   */
  async validateConfigFile(filePath: string): Promise<ConfigFileResult> {
    const result: ConfigFileResult = {
      path: filePath,
      isValid: false,
      hasEnvFile: false,
    }

    try {
      // Check if file exists and is readable
      await fs.promises.access(filePath, fs.constants.R_OK)

      // Read and parse JSON
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const config = JSON.parse(content)

      // Check for workspace_directory field
      if (config && typeof config === 'object') {
        result.isValid = true
        if (config.workspace_directory && typeof config.workspace_directory === 'string') {
          result.workspaceDirectory = config.workspace_directory
        }
      }

      // Check for .env file in same directory
      const envPath = path.join(path.dirname(filePath), '.env')
      try {
        await fs.promises.access(envPath, fs.constants.R_OK)
        result.hasEnvFile = true
      } catch {
        result.hasEnvFile = false
      }
    } catch (error) {
      result.isValid = false
      if (error instanceof SyntaxError) {
        result.error = 'Invalid JSON format'
      } else if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        result.error = 'File not found'
      } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        result.error = 'Permission denied'
      } else {
        result.error = (error as Error).message || 'Unknown error'
      }
    }

    return result
  }

  /**
   * Copy workspace directory contents to a new location
   */
  async copyWorkspace(sourceDir: string, destDir: string): Promise<CopyWorkspaceResult> {
    try {
      // Verify source exists
      const sourceStats = await fs.promises.stat(sourceDir)
      if (!sourceStats.isDirectory()) {
        return {
          success: false,
          filesCopied: 0,
          error: 'Source is not a directory',
        }
      }

      // Create destination directory
      await fs.promises.mkdir(destDir, { recursive: true })

      // Recursively copy contents
      const filesCopied = await this.copyDirectoryContents(sourceDir, destDir)

      logger.info(`Copied ${filesCopied} files from ${sourceDir} to ${destDir}`)

      return {
        success: true,
        filesCopied,
      }
    } catch (error) {
      logger.error('Failed to copy workspace:', error)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          success: false,
          filesCopied: 0,
          error: 'Source directory not found',
        }
      }
      return {
        success: false,
        filesCopied: 0,
        error: (error as Error).message || 'Failed to copy workspace',
      }
    }
  }

  /**
   * Recursively copy directory contents
   */
  private async copyDirectoryContents(sourceDir: string, destDir: string): Promise<number> {
    let filesCopied = 0
    const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name)
      const destPath = path.join(destDir, entry.name)

      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true })
        filesCopied += await this.copyDirectoryContents(sourcePath, destPath)
      } else if (entry.isFile()) {
        await fs.promises.copyFile(sourcePath, destPath)
        filesCopied++
      }
    }

    return filesCopied
  }

  /**
   * Import config (and optionally .env) file to app's config location
   */
  async importConfig(sourcePath: string): Promise<ImportResult> {
    try {
      // First validate the source config
      const validation = await this.validateConfigFile(sourcePath)
      if (!validation.isValid) {
        return {
          success: false,
          envImported: false,
          error: validation.error || 'Invalid config file',
        }
      }

      // Get destination path
      const destConfigPath = getGtnConfigPath(this.userDataDir)
      const destDir = path.dirname(destConfigPath)

      // Ensure destination directory exists
      await fs.promises.mkdir(destDir, { recursive: true })

      // Copy config file
      await fs.promises.copyFile(sourcePath, destConfigPath)
      logger.info(`Migrated config from ${sourcePath} to ${destConfigPath}`)

      // Check and copy .env file if it exists
      let envImported = false
      if (validation.hasEnvFile) {
        const sourceEnvPath = path.join(path.dirname(sourcePath), '.env')
        const destEnvPath = path.join(destDir, '.env')

        try {
          await fs.promises.copyFile(sourceEnvPath, destEnvPath)
          envImported = true
          logger.info(`Migrated .env from ${sourceEnvPath} to ${destEnvPath}`)
        } catch (error) {
          logger.warn('Failed to copy .env file:', error)
          // Non-fatal - continue with config migration
        }
      }

      return {
        success: true,
        workspaceDirectory: validation.workspaceDirectory,
        envImported,
      }
    } catch (error) {
      logger.error('Failed to import config:', error)
      return {
        success: false,
        envImported: false,
        error: (error as Error).message || 'Failed to import config',
      }
    }
  }
}
