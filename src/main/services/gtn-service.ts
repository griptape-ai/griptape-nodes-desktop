import * as fs from 'fs';
import { getGtnExecutablePath } from './config/paths';
import { spawn } from 'child_process';
import { getEnv } from './config/env';
import { attachOutputForwarder } from '../utils/child-process/output-forwarder';


export class GtnService {
  private userDataDir: string;
  private defaultWorkspaceDir: string;

  constructor(userDataDir: string, defaultWorkspaceDir: string) {
    this.userDataDir = userDataDir;
    this.defaultWorkspaceDir = defaultWorkspaceDir;
  }

  /**
   * Initialize gtn with API key and optional settings
   */
  async initialize(options: {
    apiKey: string;
    workspaceDirectory?: string;
    storageBackend?: 'local' | 'gtc';
    bucketName?: string;
  }): Promise<void> {
    const gtnPath = getGtnExecutablePath(this.userDataDir);
    if (!gtnPath) {
      throw new Error('Griptape Nodes executable not found');
    }

    // Build command arguments
    const args = ['init', '--no-interactive'];
    
    // API key is required
    args.push('--api-key', options.apiKey);
    
    // Use workspace directory from options or default
    const workspace = options.workspaceDirectory || this.defaultWorkspaceDir;
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
    await this.runGtn(args);

  }

  /**
   * Check if gtn is initialized
   */
  isInitialized(): boolean {
    // TODO: implement
    throw new Error("Not yet implemented");
    return false;
  }

  /**
   * Get current workspace directory from config
   */
  getWorkspaceDirectory(): string {
    // TODO: implement non-default
    throw new Error("Not yet implemented");
    // const config = this.loadConfig();
    // return config?.workspace_directory || this.defaultWorkspaceDir;
  }

  /**
   * Update workspace directory
   */
  async updateWorkspaceDirectory(directory: string): Promise<{ success: boolean; error?: string }> {
    throw new Error("Not yet implemented");
    // try {
    //   const config = this.loadConfig();
    //   if (!config || !config.api_key) {
    //     return { 
    //       success: false, 
    //       error: 'Griptape Nodes not initialized. Please log in first.' 
    //     };
    //   }

    //   // Re-initialize with new workspace directory
    //   return await this.initialize({
    //     apiKey: config.api_key,
    //     workspaceDirectory: directory,
    //     storageBackend: config.storage_backend,
    //     bucketName: config.bucket_name
    //   });
    // } catch (error) {
    //   return { 
    //     success: false, 
    //     error: error instanceof Error ? error.message : 'Unknown error' 
    //   };
    // }
  }

  /**
   * Sync libraries with current engine version
   */
  async syncLibraries() {
    await this.runGtn(['libraries', 'sync']);
  }

  /**
   * Execute a griptape-nodes command asynchronously
   */
  async runGtn(args: string[]) {
    const gtnExecutablePath = getGtnExecutablePath(this.userDataDir);
    const env = getEnv(this.userDataDir);
    const child = spawn(gtnExecutablePath, args, { env });
    await attachOutputForwarder(child, { logPrefix: `gtn ${args.join(' ')}` });
  }

  /**
   * Check if griptape-nodes is available
   */
  isGriptapeNodesReady(): boolean {
    const gtnExecutablePath = getGtnExecutablePath(this.userDataDir);
    // Assume "ready?" when executable exists.
    return fs.existsSync(gtnExecutablePath);
  }

}