import * as fs from 'fs';
import * as path from 'path';
import { PythonService } from '../python';
import { getPythonVersion, getPythonInstallDir, getUvToolDir } from '../downloader';

export interface EnvironmentInfo {
  python: {
    version: string;
    executable: string;
    systemPath: string[];
    installedPackages?: string[];
  };
  griptapeNodes: {
    path: string;
    version: string;
    installed: boolean;
  };
  uv: {
    version: string;
    toolDir: string;
    pythonInstallDir: string;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
  };
  collectedAt: string;
  errors: string[];
}

export class EnvironmentSetupService {
  private dataPath: string;
  private envInfoFile: string;
  private resourcesPath: string;

  constructor(private pythonService: PythonService, dataPath: string, resourcesPath: string) {
    this.dataPath = dataPath;
    this.resourcesPath = resourcesPath;
    this.envInfoFile = path.join(this.dataPath, 'environment-info.json');
  }

  /**
   * Run post-installation setup and collect environment information
   */
  async runPostInstallSetup(): Promise<EnvironmentInfo> {
    console.log('Starting post-installation setup...');
    const errors: string[] = [];

    // Run tasks in parallel where possible
    const [
      griptapeNodesResult,
      pythonInfo,
      uvVersion
    ] = await Promise.allSettled([
      this.ensureGriptapeNodes(),
      this.collectPythonInfo(),
      this.getUvVersion()
    ]);

    // Process Python info
    let pythonData = {
      version: '',
      executable: '',
      systemPath: [] as string[],
      installedPackages: [] as string[]
    };
    
    if (pythonInfo.status === 'fulfilled') {
      pythonData = pythonInfo.value;
    } else {
      errors.push(`Failed to collect Python info: ${pythonInfo.reason}`);
    }

    // Process Griptape Nodes info
    let griptapeNodesData = {
      path: '',
      version: '',
      installed: false
    };

    if (griptapeNodesResult.status === 'fulfilled') {
      griptapeNodesData = griptapeNodesResult.value;
    } else {
      errors.push(`Failed to setup Griptape Nodes: ${griptapeNodesResult.reason}`);
    }

    // Process UV info
    let uvVersionStr = 'Unknown';
    if (uvVersion.status === 'fulfilled') {
      uvVersionStr = uvVersion.value;
    } else {
      errors.push(`Failed to get UV version: ${uvVersion.reason}`);
    }

    // Collect environment info
    const envInfo: EnvironmentInfo = {
      python: pythonData,
      griptapeNodes: griptapeNodesData,
      uv: {
        version: uvVersionStr,
        toolDir: getUvToolDir(this.dataPath),
        pythonInstallDir: getPythonInstallDir(this.resourcesPath)
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron || 'Unknown'
      },
      collectedAt: new Date().toISOString(),
      errors
    };

    // Save to persistent storage
    this.saveEnvironmentInfo(envInfo);
    
    return envInfo;
  }

  /**
   * Collect Python information in parallel
   */
  private async collectPythonInfo(): Promise<{
    version: string;
    executable: string;
    systemPath: string[];
    installedPackages?: string[];
  }> {
    const executable = this.pythonService.getPythonExecutablePath();
    if (!executable) {
      throw new Error('Python executable not found');
    }

    // Run multiple Python commands in parallel
    const commands = [
      { cmd: 'import sys; print(sys.version)', key: 'version' },
      { cmd: 'import sys; print("\\n".join(sys.path))', key: 'syspath' },
      { cmd: 'import pkg_resources; print("\\n".join([f"{d.key}=={d.version}" for d in pkg_resources.working_set]))', key: 'packages' }
    ];

    const results = await Promise.allSettled(
      commands.map(({ cmd }) => 
        new Promise<string>((resolve, reject) => {
          const result = this.pythonService.executePythonCommand(cmd);
          if (result.success) {
            resolve(result.stdout.trim());
          } else {
            reject(new Error(result.stderr || 'Command failed'));
          }
        })
      )
    );

    return {
      version: results[0].status === 'fulfilled' ? results[0].value : getPythonVersion(),
      executable,
      systemPath: results[1].status === 'fulfilled' 
        ? results[1].value.split('\n').filter(p => p.trim()) 
        : [],
      installedPackages: results[2].status === 'fulfilled'
        ? results[2].value.split('\n').filter(p => p.trim())
        : undefined
    };
  }

  /**
   * Ensure Griptape Nodes is installed
   */
  private async ensureGriptapeNodes(): Promise<{
    path: string;
    version: string;
    installed: boolean;
  }> {
    try {
      // Check if already installed
      if (this.pythonService.isGriptapeNodesReady()) {
        console.log('Griptape Nodes already installed');
        return {
          path: this.pythonService.getGriptapeNodesPath() || '',
          version: this.pythonService.getGriptapeNodesVersion(),
          installed: true
        };
      }

      // Install Griptape Nodes
      console.log('Installing Griptape Nodes...');
      await this.pythonService.installGriptapeNodes();
      
      return {
        path: this.pythonService.getGriptapeNodesPath() || '',
        version: this.pythonService.getGriptapeNodesVersion(),
        installed: true
      };
    } catch (error) {
      console.error('Failed to install Griptape Nodes:', error);
      throw error;
    }
  }

  /**
   * Get UV version
   */
  private async getUvVersion(): Promise<string> {
    return this.pythonService.getUvVersion();
  }

  /**
   * Save environment info to persistent storage
   */
  private saveEnvironmentInfo(info: EnvironmentInfo): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }

      // Write environment info to file
      fs.writeFileSync(this.envInfoFile, JSON.stringify(info, null, 2));
      console.log('Environment info saved to:', this.envInfoFile);
    } catch (error) {
      console.error('Failed to save environment info:', error);
      throw error;
    }
  }

  /**
   * Load environment info from persistent storage
   */
  loadEnvironmentInfo(): EnvironmentInfo | null {
    try {
      if (fs.existsSync(this.envInfoFile)) {
        const data = fs.readFileSync(this.envInfoFile, 'utf8');
        return JSON.parse(data) as EnvironmentInfo;
      }
      return null;
    } catch (error) {
      console.error('Failed to load environment info:', error);
      return null;
    }
  }

  /**
   * Check if environment info exists
   */
  hasEnvironmentInfo(): boolean {
    return fs.existsSync(this.envInfoFile);
  }

  /**
   * Clear environment info (useful for forcing re-collection)
   */
  clearEnvironmentInfo(): void {
    try {
      if (fs.existsSync(this.envInfoFile)) {
        fs.unlinkSync(this.envInfoFile);
        console.log('Environment info cleared');
      }
    } catch (error) {
      console.error('Failed to clear environment info:', error);
    }
  }

  /**
   * Refresh environment info without reinstalling
   */
  async refreshEnvironmentInfo(): Promise<EnvironmentInfo> {
    console.log('Refreshing environment information...');
    return this.runPostInstallSetup();
  }
}