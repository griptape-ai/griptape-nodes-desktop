import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from "path";
import { readdir } from "fs/promises";
import { collectStdout } from '../../child-process/collect-stdout';
import { attachOutputForwarder } from '../../child-process/output-forwarder';
import { getEnv } from '../../config/env';
import { getCwd, getGtnConfigPath, getGtnExecutablePath, getXdgDataHome } from '../../config/paths';
import { logger } from '@/logger';
import { UvService } from '../uv/uv-service';
import EventEmitter from 'events';
import { installGtn } from './install-gtn';
import { PythonService } from '../python/python-service';
import { HttpAuthService } from '../auth/http';

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

export function mergeNestedArray<T>({ obj, path, items, unique }: {
  obj: Record<string, any>;
  path: string[];
  items: T[];
  unique: boolean;
}): void {
  const parent = path.slice(0, -1).reduce<any>((a, k) =>
    a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? a[k] : (a[k] = {}), obj);
  const key = path[path.length - 1], cur = parent[key],
    base: T[] = cur === undefined ? [] : Array.isArray(cur) ? cur : [cur];
  parent[key] = unique ? Array.from(new Set<T>([...base, ...items])) : [...base, ...items];
}


interface GtnServiceEvents {
  'ready': [];
}

export class GtnService extends EventEmitter<GtnServiceEvents> {
  private isReady: boolean = false;
  private workspaceDirectory?: string;
  private gtnExecutablePath?: string;

  constructor(
    private userDataDir: string,
    private defaultWorkspaceDir: string,
    private uvService: UvService,
    private pythonService: PythonService,
    private authService: HttpAuthService,
  ) {
    super();
  }

  async start() {
    logger.info("gtn service start");
    await this.uvService.waitForReady();
    await this.pythonService.waitForReady();
    await this.installGtn();
    await this.syncLibraries();
    await this.registerLibraries();
    const apiKey = await this.authService.waitForApiKey();
    await this.initialize({ apiKey })


    this.isReady = true;
    this.emit('ready');
    logger.info("gtn service ready");
  }

  async waitForReady(): Promise<void> {
    if (this.isReady) {
      return Promise.resolve();
    }
    return new Promise(resolve => this.once('ready', resolve));
  }

  async installGtn() {
    logger.info('gtn service installGtn start');
    const uvExecutablePath = await this.uvService.getUvExecutablePath();
    await installGtn(this.userDataDir, uvExecutablePath);
    this.gtnExecutablePath = getGtnExecutablePath(this.userDataDir);
    logger.info('gtn service installGtn end');
  }

  async getGtnExecutablePath(): Promise<string> {
    await this.waitForReady();
    return this.gtnExecutablePath;
  }

  async initialize(options: {
    apiKey: string;
    workspaceDirectory?: string;
    storageBackend?: 'local' | 'gtc';
    bucketName?: string;
  }): Promise<void> {
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

  async findLibraryConfigPaths() {
    const dir = getXdgDataHome(this.userDataDir);
    if (!fs.existsSync((dir))) {
      return [];
    }
    let libraryPaths = await findFiles(dir, "griptape_nodes_library.json");
    // Filter out advanced media lib for now, until we add library management.
    libraryPaths = libraryPaths.filter(value => !value.includes("griptape_nodes_advanced_media_library"));
    return libraryPaths
  }

  /**
   * Sync libraries with current engine version
   */
  async syncLibraries() {
    let libraryPaths = await this.findLibraryConfigPaths();
    if (libraryPaths.length > 0) {
      // Skip sync if already installed.
      // Ideally we'd force retry installation if a library
      // is FLAWED or UNUSABLE. But that's for later.
      logger.info(`GtnService: SKIPPING SYNC, libraryPaths: "${libraryPaths}"`)
      return;
    }

    const child = await this.runGtn(['libraries', 'sync']);

    // We don't actually care about the output here. We just
    // want it to finish. Ideally we'd have another util like
    // this that doesn't waste time and space buffering the
    // output.
    await collectStdout(child);
  }

  async registerLibraries() {
    let libraryPaths = await this.findLibraryConfigPaths();
    const gtnConfigPath = getGtnConfigPath(this.userDataDir);
    const data = fs.existsSync(gtnConfigPath) ? fs.readFileSync(gtnConfigPath, 'utf8') : "{}";
    const json = JSON.parse(data);
    mergeNestedArray({
      obj: json,
      path: [
        "app_events",
        "on_app_initialization_complete",
        "libraries_to_register",
      ],
      items: libraryPaths,
      unique: true,
    });
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

  async runGtn(args: string[] = [], forward_logs: boolean = false): Promise<ChildProcess> {
    // Hack to ensure executable is available by the time login is complete
    // and the UI tries to use it.
    while (!this.gtnExecutablePath) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const env = getEnv(this.userDataDir);
    const cwd = getCwd(this.userDataDir);
    const child = spawn(this.gtnExecutablePath, ['--no-update', ...args], { env, cwd });
    if (forward_logs) {
      attachOutputForwarder(child, { logPrefix: `gtn ${args.join(' ')}`.slice(0, 10) });
    }
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
