import * as path from 'path';
import * as fs from 'fs';
import { execSync, spawnSync } from 'child_process';
import { getPythonVersion, getUvPath, getPythonInstallDir, getUvToolDir } from '../downloader';

export class PythonService {
  private platform: string;
  private arch: string;
  private uvPath: string;

  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.uvPath = getUvPath(this.platform, this.arch);
    console.log(`uv path: ${this.uvPath}`)
  }

  /**
   * Get the path to the bundled Python executable
   */
  getPythonExecutablePath(): string | null {
    try {
      // Use the same UV_PYTHON_INSTALL_DIR as during download to ensure consistency
      const env = { 
        ...process.env, 
        UV_PYTHON_INSTALL_DIR: getPythonInstallDir()
      };
      
      const result = execSync(`"${this.uvPath}" python find ${getPythonVersion()}`, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });
      return result.trim();
    } catch (error) {
      console.error('Failed to find Python executable:', error);
      return null;
    }
  }

  /**
   * Execute a Python command and return the result
   */
  executePythonCommand(command: string): { stdout: string; stderr: string; success: boolean } {
    try {
      const pythonPath = this.getPythonExecutablePath();
      if (!pythonPath) {
        return {
          stdout: '',
          stderr: 'Python executable not found',
          success: false
        };
      }

      const result = spawnSync(pythonPath, ['-c', command], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (result.error) {
        throw result.error;
      }

      console.log(`executePythonCommand ${command} success`);
      return {
        stdout: result.stdout?.toString() || '',
        stderr: result.stderr?.toString() || '',
        success: result.status === 0
      };
    } catch (error: any) {
      console.log(`executePythonCommand error: ${error}`);
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        success: false
      };
    }
  }

  /**
   * Get Python version and executable path info
   */
  getPythonInfo(): { version: string; executable: string | null; success: boolean } {
    const executable = this.getPythonExecutablePath();
    if (!executable) {
      return {
        version: '',
        executable: null,
        success: false
      };
    }

    const versionResult = this.executePythonCommand('import sys; print(sys.version)');
    
    return {
      version: versionResult.success ? versionResult.stdout.trim() : 'Unknown',
      executable,
      success: versionResult.success
    };
  }

  /**
   * Check if Python and uv are properly installed
   */
  isReady(): boolean {
    try {
      // Check if uv exists
      if (!fs.existsSync(this.uvPath)) {
        console.log('uv executable not found at:', this.uvPath);
        return false;
      }

      // Check if Python can be found
      const pythonPath = this.getPythonExecutablePath();
      if (!pythonPath || !fs.existsSync(pythonPath)) {
        console.log('Python executable not found');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking Python service readiness:', error);
      return false;
    }
  }

  /**
   * Get the bundled Python version
   */
  getBundledPythonVersion(): string {
    return getPythonVersion();
  }

  /**
   * Get the bundled uv version
   */
  getUvVersion(): string {
    try {
      const result = execSync(`"${this.uvPath}" --version`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return result.trim();
    } catch (error) {
      console.error('Failed to get uv version:', error);
      return 'Unknown';
    }
  }

  /**
   * Install griptape-nodes tool (post-install)
   */
  async installGriptapeNodes(): Promise<void> {
    console.log('Installing griptape-nodes tool...');
    
    try {
      const toolDir = getUvToolDir();
      const env = { 
        ...process.env, 
        UV_PYTHON_INSTALL_DIR: getPythonInstallDir(),
        UV_TOOL_DIR: toolDir,
        UV_TOOL_BIN_DIR: path.join(toolDir, 'bin')
      };
      
      // Install griptape-nodes using uv
      execSync(`"${this.uvPath}" tool install griptape-nodes`, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        env 
      });
      
      console.log('Successfully installed griptape-nodes');
    } catch (error: any) {
      console.error('Failed to install griptape-nodes:', error.message);
      if (error.stdout) console.error('stdout:', error.stdout.toString());
      if (error.stderr) console.error('stderr:', error.stderr.toString());
      throw error;
    }
  }

  /**
   * Ensure griptape-nodes is installed (install if missing)
   */
  async ensureGriptapeNodes(): Promise<void> {
    if (!this.isGriptapeNodesReady()) {
      console.log('griptape-nodes not found, installing...');
      await this.installGriptapeNodes();
    } else {
      console.log('griptape-nodes already installed');
    }
  }

  /**
   * Get the path to the bundled griptape-nodes executable
   */
  getGriptapeNodesPath(): string | null {
    const toolDir = getUvToolDir();
    const executable = path.join(toolDir, 'bin', this.platform === 'win32' ? 'griptape-nodes.exe' : 'griptape-nodes');
    
    if (fs.existsSync(executable)) {
      return executable;
    }
    
    console.error('griptape-nodes executable not found at:', executable);
    return null;
  }

  /**
   * Execute a griptape-nodes command
   */
  executeGriptapeNodesCommand(args: string[]): { stdout: string; stderr: string; success: boolean } {
    try {
      const griptapeNodesPath = this.getGriptapeNodesPath();
      if (!griptapeNodesPath) {
        return {
          stdout: '',
          stderr: 'griptape-nodes executable not found',
          success: false
        };
      }

      // Use consistent environment variables
      const env = { 
        ...process.env, 
        UV_PYTHON_INSTALL_DIR: getPythonInstallDir(),
        UV_TOOL_DIR: getUvToolDir()
      };

      const result = spawnSync(griptapeNodesPath, args, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      if (result.error) {
        throw result.error;
      }

      return {
        stdout: result.stdout?.toString() || '',
        stderr: result.stderr?.toString() || '',
        success: result.status === 0
      };
    } catch (error: any) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        success: false
      };
    }
  }

  /**
   * Check if griptape-nodes is available
   */
  isGriptapeNodesReady(): boolean {
    return this.getGriptapeNodesPath() !== null;
  }

  /**
   * Get the griptape-nodes version
   */
  getGriptapeNodesVersion(): string {
    try {
      const result = this.executeGriptapeNodesCommand(['self', 'version']);
      if (result.success) {
        return result.stdout.trim();
      }
      return 'Unknown';
    } catch (error) {
      console.error('Failed to get griptape-nodes version:', error);
      return 'Unknown';
    }
  }
}
