import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from "path";
import { readdir } from "fs/promises";
import { collectStdout } from '../child-process/collect-stdout';
import { attachOutputForwarder } from '../child-process/output-forwarder';
import { getEnv } from '../config/env';
import { getCwd, getGtnConfigPath, getGtnExecutablePath, getXdgDataHome } from '../config/paths';
import { logger } from '@/logger';

async function findFiles(dir: string, target: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (e): Promise<string[] | string> => {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) return findFiles(fullPath, target);
      if (e.isFile() && e.name === target) return path.resolve(fullPath);
      return [];
    })
  );
  return results.flat();
}

function setNested(
  obj: Record<string, any>,
  path: string[],
  value: unknown
): void {
  path.reduce<Record<string, any>>((acc, key, i) => {
    if (i === path.length - 1) {
      acc[key] = value;
    } else {
      acc[key] ??= {};
    }
    return acc[key];
  }, obj);
}


export class GtnService {
  private workspaceDirectory?: string;
  constructor(
    private userDataDir: string,
    private defaultWorkspaceDir: string,
    private gtnExecutablePath?: string,
  ) {}

  setGtnExecutablePath(gtnExecutablePath?: string) {
    this.gtnExecutablePath = gtnExecutablePath;
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
    logger.info('Running gtn init with args:', sanitizedArgs.join(' '));

    // Execute gtn init from the config directory so it finds our config file (async)
    this.runGtn(args);

  }


  async getWorkspaceDirectory(): Promise<string> {
    // TODO: Sync with config / cli somehow.
    await this.refreshConfig()
    return this.workspaceDirectory || this.defaultWorkspaceDir;
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
    const child = await this.runGtn(['libraries', 'sync']);
    await collectStdout(child);
  }

  async registerLibraries() {
    let libraryPaths = await findFiles(getXdgDataHome(this.userDataDir), "griptape_nodes_library.json");
    // Filter out advanced media lib.
    libraryPaths = libraryPaths.filter(value => !value.includes("griptape_nodes_advanced_media_library"));
    const gtnConfigPath = getGtnConfigPath(this.userDataDir);
    const data = fs.existsSync(gtnConfigPath) ? fs.readFileSync(gtnConfigPath, 'utf8') : "{}";
    const json = JSON.parse(data);
    setNested(json, [
      "app_events",
      "on_app_initialization_complete",
      "libraries_to_register",
    ], libraryPaths);
    fs.mkdirSync(path.dirname(gtnConfigPath), { recursive: true });
    fs.writeFileSync(gtnConfigPath, JSON.stringify(json, null, 2), 'utf8');
  }

  async refreshConfig() {
    const child = await this.runGtn(['config', 'show']);
    const json = await collectStdout(child);
    const config = JSON.parse(json);
    const workspaceDirectory = config?.workspace_directory || this.defaultWorkspaceDir;
    this.workspaceDirectory = workspaceDirectory;
  }

  async runGtn(args: string[] = []): Promise<ChildProcess> {
    // Hack to ensure executable is available by the time login is complete
    // and the UI tries to use it.
    while (!this.gtnExecutablePath) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const env = getEnv(this.userDataDir);
    const cwd = getCwd(this.userDataDir);
    const child = spawn(this.gtnExecutablePath, args, { env, cwd });
    attachOutputForwarder(child, { logPrefix: `gtn ${args.join(' ')}`.slice(0,10) });
    return child;
  }

  async getGtnVersion(): Promise<string> {
    const child = await this.runGtn(['self', 'version']);
    return await collectStdout(child);
  }

  gtnExecutableExists(): boolean {
    return fs.existsSync(this.gtnExecutablePath);
  }
}