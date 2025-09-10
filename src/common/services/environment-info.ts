import * as fs from 'fs';
import * as path from 'path';

export interface EnvironmentInfo {
  python: {
    version: string;
    executable: string;
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

export class EnvironmentInfoService {
  private envInfoFile: string;

  constructor(private userDataPath: string) {
    this.envInfoFile = path.join(this.userDataPath, 'environment-info.json');
  }

  /**
   * Save environment info to persistent storage
   */
  saveEnvironmentInfo(info: EnvironmentInfo): void {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
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