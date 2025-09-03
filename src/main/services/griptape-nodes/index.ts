import * as fs from 'fs';
import * as path from 'path';
import { PythonService } from '../python';

export interface GtnConfig {
  api_key?: string;
  workspace_directory?: string;
  storage_backend?: 'local' | 'gtc';
  bucket_name?: string;
  libraries?: string[];
}

export class GriptapeNodesService {
  private pythonService: PythonService;
  private configDir: string;
  private configFile: string;
  private workspaceDir: string;

  constructor(pythonService: PythonService, configDir: string, workspaceDir: string) {
    this.pythonService = pythonService;
    this.configDir = configDir;
    this.configFile = path.join(this.configDir, 'griptape_nodes_config.json');
    this.workspaceDir = workspaceDir;
    this.ensureConfigDirectory();
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDirectory(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Load current configuration
   */
  loadConfig(): GtnConfig | null {
    try {
      if (fs.existsSync(this.configFile)) {
        const content = fs.readFileSync(this.configFile, 'utf-8');
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      console.error('Failed to load gtn config:', error);
      return null;
    }
  }

  /**
   * Save configuration
   */
  saveConfig(config: GtnConfig): void {
    try {
      this.ensureConfigDirectory();
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      console.log('Saved gtn config to:', this.configFile);
    } catch (error) {
      console.error('Failed to save gtn config:', error);
      throw error;
    }
  }

  /**
   * Initialize gtn with API key and optional settings
   */
  async initialize(options: {
    apiKey: string;
    workspaceDirectory?: string;
    storageBackend?: 'local' | 'gtc';
    bucketName?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const gtnPath = this.pythonService.getGriptapeNodesPath();
      if (!gtnPath) {
        return { success: false, error: 'Griptape Nodes executable not found' };
      }

      // Build command arguments
      const args = ['init', '--no-interactive'];
      
      // API key is required
      args.push('--api-key', options.apiKey);
      
      // Use workspace directory from options or default
      const workspace = options.workspaceDirectory || this.workspaceDir;
      args.push('--workspace-directory', workspace);
      
      // Storage backend (default to local)
      const storageBackend = options.storageBackend || 'local';
      args.push('--storage-backend', storageBackend);
      
      // Bucket name for gtc storage
      if (storageBackend === 'gtc' && options.bucketName) {
        args.push('--bucket-name', options.bucketName);
      }

      // Log the command without exposing the API key
      const sanitizedArgs = [...args];
      const apiKeyIndex = sanitizedArgs.indexOf('--api-key');
      if (apiKeyIndex !== -1 && apiKeyIndex + 1 < sanitizedArgs.length) {
        sanitizedArgs[apiKeyIndex + 1] = '[REDACTED]';
      }
      console.log('Running gtn init with args:', sanitizedArgs.join(' '));

      // Execute gtn init from the config directory so it finds our config file (async)
      const result = await this.pythonService.executeGriptapeNodesCommandAsync(args, { cwd: this.configDir });

      if (result.success) {
        // Save config for reference
        const config: GtnConfig = {
          api_key: options.apiKey,
          workspace_directory: workspace,
          storage_backend: storageBackend,
          bucket_name: options.bucketName
        };
        this.saveConfig(config);

        console.log('Successfully initialized griptape-nodes');
        return { success: true };
      } else {
        console.error('Failed to initialize griptape-nodes:', result.stderr);
        return { 
          success: false, 
          error: result.stderr || 'Failed to initialize griptape-nodes' 
        };
      }
    } catch (error) {
      console.error('Error during gtn init:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check if gtn is initialized
   */
  isInitialized(): boolean {
    try {
      console.log('[GTN] Checking initialization, config file:', this.configFile);
      // Check if our config file exists and has an API key
      if (fs.existsSync(this.configFile)) {
        console.log('[GTN] Config file exists');
        const config = this.loadConfig();
        console.log('[GTN] Config loaded:', config ? 'Yes' : 'No', 'Has API key:', config?.api_key ? 'Yes' : 'No');
        // If we have a saved config with an API key, assume we're initialized
        // We can't reliably check with gtn commands without potentially triggering errors
        const result = config !== null && !!config.api_key;
        console.log('[GTN] isInitialized result:', result);
        return result;
      }
      console.log('[GTN] Config file does not exist');
      return false;
    } catch (error) {
      console.error('[GTN] Failed to check gtn initialization:', error);
      return false;
    }
  }

  /**
   * Get current workspace directory from config
   */
  getWorkspaceDirectory(): string {
    const config = this.loadConfig();
    return config?.workspace_directory || this.workspaceDir;
  }

  /**
   * Update workspace directory
   */
  async updateWorkspaceDirectory(directory: string): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.loadConfig();
      if (!config || !config.api_key) {
        return { 
          success: false, 
          error: 'Griptape Nodes not initialized. Please log in first.' 
        };
      }

      // Re-initialize with new workspace directory
      return await this.initialize({
        apiKey: config.api_key,
        workspaceDirectory: directory,
        storageBackend: config.storage_backend,
        bucketName: config.bucket_name
      });
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get config directory path (for setting working directory)
   */
  getConfigDirectory(): string {
    return this.configDir;
  }
}