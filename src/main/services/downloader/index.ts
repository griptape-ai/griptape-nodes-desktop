import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream } from 'fs';
import { spawn } from 'child_process';
import extractZip from 'extract-zip';
import { attachOutputForwarder } from '../../utils/child-process/output-forwarder';

const PYTHON_VERSION = '3.12.7';


interface UvBuild {
  url: string;
  filename: string;
}

const UV_BUILDS: Record<string, Record<string, UvBuild>> = {
  win32: {
    x64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip',
      filename: 'uv-x86_64-pc-windows-msvc.zip'
    }
  },
  darwin: {
    x64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-apple-darwin.tar.gz',
      filename: 'uv-x86_64-apple-darwin.tar.gz'
    },
    arm64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-aarch64-apple-darwin.tar.gz',
      filename: 'uv-aarch64-apple-darwin.tar.gz'
    }
  },
  linux: {
    x64: {
      url: 'https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz',
      filename: 'uv-x86_64-unknown-linux-gnu.tar.gz'
    }
  }
};

async function downloadFile(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.destroy();
          downloadFile(redirectUrl, filepath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.destroy();
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          // Additional wait to ensure file handle is fully released
          setTimeout(() => {
            resolve();
          }, 500);
        });
      });
      file.on('error', reject);
    }).on('error', (err) => {
      file.destroy();
      reject(err);
    });
  });
}

async function extractUv(archivePath: string, extractPath: string, platform: string): Promise<void> {
  if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath, { recursive: true });
  }

  try {
    if (platform === 'win32' && archivePath.endsWith('.zip')) {
      console.log(`Extracting ${archivePath} to ${extractPath}...`);

      await extractZip(archivePath, { dir: extractPath });

      console.log('Extraction completed, looking for uv.exe...');

      // Find the uv.exe file in the extracted contents
      function findUvRecursive(dir: string): string | null {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        console.log(`Searching in ${dir}, found entries:`, entries.map(e => `${e.name} (${e.isDirectory() ? 'dir' : 'file'})`));

        for (const entry of entries) {
          if (entry.name === 'uv.exe' && entry.isFile()) {
            return path.join(dir, entry.name);
          } else if (entry.isDirectory()) {
            const found = findUvRecursive(path.join(dir, entry.name));
            if (found) return found;
          }
        }
        return null;
      }

      const uvExePath = findUvRecursive(extractPath);

      if (!uvExePath) {
        console.error('UV executable not found. Archive contents:');
        const listContents = (dir: string, prefix = '') => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            console.log(`${prefix}${entry.name} (${entry.isDirectory() ? 'dir' : 'file'})`);
            if (entry.isDirectory()) {
              listContents(path.join(dir, entry.name), prefix + '  ');
            }
          }
        };
        listContents(extractPath);
        throw new Error('uv.exe not found in extracted archive');
      }

      // If uv.exe is not directly in extractPath, move it there
      const expectedPath = path.join(extractPath, 'uv.exe');
      if (uvExePath !== expectedPath) {
        console.log(`Moving uv.exe from ${uvExePath} to ${expectedPath}`);
        fs.copyFileSync(uvExePath, expectedPath);

        // Clean up the directory structure if uv was in a subdirectory
        const uvDir = path.dirname(uvExePath);
        if (uvDir !== extractPath) {
          fs.rmSync(uvDir, { recursive: true, force: true });
        }
      }

      console.log(`uv.exe ready at ${expectedPath}`);
    } else if (archivePath.endsWith('.tar.gz')) {
      console.log(`Extracting ${archivePath} to ${extractPath}...`);
      const tarProcess = spawn('tar', ['-xzf', archivePath, '-C', extractPath, '--strip-components=1'], {
        shell: true,
      });
      await attachOutputForwarder(tarProcess, {
        logPrefix: 'EXTRACT_UV'
      });
    }
  } catch (error) {
    console.error('UV extraction failed:', error);
    throw error;
  }
}

async function downloadAndExtractUv(platform: string, arch: string, userDataDir: string): Promise<string> {
  const build = UV_BUILDS[platform]?.[arch];
  if (!build) {
    throw new Error(`No uv build available for ${platform}-${arch}`);
  }

  const uvInstallDir = getUvInstallDir(userDataDir);
  const uvDir = path.join(uvInstallDir, `${platform}-${arch}`);
  const archivePath = path.join(uvInstallDir, build.filename);
  const uvExecutable = path.join(uvDir, platform === 'win32' ? 'uv.exe' : 'uv');

  // Skip if uv already exists
  if (fs.existsSync(uvExecutable)) {
    console.log(`uv for ${platform}-${arch} already exists, skipping download`);
    return uvExecutable;
  }

  // Create directories
  if (!fs.existsSync(path.dirname(archivePath))) {
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  }

  console.log(`Downloading uv for ${platform}-${arch}...`);
  await downloadFile(build.url, archivePath);
  console.log(`Downloaded uv to: ${archivePath}`);

  // Verify the downloaded file is complete and accessible before extraction
  console.log(`Verifying downloaded file integrity...`);
  let verifyRetries = 0;
  const maxVerifyRetries = 5;
  while (verifyRetries < maxVerifyRetries) {
    try {
      const stats = fs.statSync(archivePath);
      if (stats.size > 0) {
        // Try to read a small portion to ensure file isn't locked
        const fd = fs.openSync(archivePath, 'r');
        fs.closeSync(fd);
        break;
      }
    } catch (error) {
      console.log(`Downloaded file not ready, waiting... (attempt ${verifyRetries + 1}/${maxVerifyRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    verifyRetries++;
  }

  if (verifyRetries === maxVerifyRetries) {
    throw new Error('Downloaded file is not accessible after multiple attempts');
  }

  console.log(`File verification complete, proceeding with extraction...`);
  await extractUv(archivePath, uvDir, platform);

  // Make executable on Unix systems
  if (platform !== 'win32') {
    const chmodProcess = spawn('chmod', ['+x', uvExecutable], {
      shell: true,
    });
    await attachOutputForwarder(chmodProcess, {
      logPrefix: 'CHMOD_UV'
    });
  }

  // Clean up archive
  fs.unlinkSync(archivePath);

  console.log(`uv extracted to: ${uvExecutable}`);
  return uvExecutable;
}

async function downloadPythonWithUv(uvExecutable: string, platform: string, arch: string, userDataDir: string): Promise<void> {
  console.log(`Using uv to install Python ${PYTHON_VERSION} for ${platform}-${arch}...`);

  try {
    // Set UV_PYTHON_INSTALL_DIR to our user data directory and force uv-managed Python only
    const env = {
      // ...process.env,
      UV_PYTHON_INSTALL_DIR: getPythonInstallDir(userDataDir),
      UV_MANAGED_PYTHON: '1',
      UV_NO_CONFIG: "1",
      UV_NO_MODIFY_PATH: "1",
      UV_PYTHON_INSTALL_REGISTRY: "0",
      UV_NO_PROGRESS: "1",
    };

    // Install Python using uv
    const uvProcess = spawn(uvExecutable, ['python', 'install', PYTHON_VERSION], {
      env,
      shell: true,
    });

    await attachOutputForwarder(uvProcess, {
      logPrefix: 'INSTALLPYTHON'
    });

    console.log(`Successfully installed Python ${PYTHON_VERSION} using uv`);
  } catch (error) {
    console.error(`Failed to install Python with uv:`, error);
    throw error;
  }
}

async function installGriptapeNodes(uvExecutable: string, userDataDir: string): Promise<void> {
  console.log('Installing griptape-nodes tool...');

  try {
    const toolDir = getUvToolDir(userDataDir);
    const env = {
      ...process.env,
      UV_PYTHON_INSTALL_DIR: getPythonInstallDir(userDataDir),
      UV_TOOL_DIR: toolDir,
      UV_TOOL_BIN_DIR: path.join(toolDir, 'bin'),
      UV_MANAGED_PYTHON: '1'
    };

    // Install griptape-nodes using uv
    const installProcess = spawn(uvExecutable, ['tool', 'install', '--quiet', 'griptape-nodes'], {
      env,
      shell: true,
    });
    await attachOutputForwarder(installProcess, {
      logPrefix: 'INSTALL_GRIPTAPE_NODES'
    });

    console.log('Successfully installed griptape-nodes tool');
  } catch (error) {
    console.error('Failed to install griptape-nodes tool:', error);
    throw error;
  }
}

export async function downloadAndInstallAll(platform: string, arch: string, userDataDir: string): Promise<void> {
  try {
    // First download and extract uv
    const uvExecutable = await downloadAndExtractUv(platform, arch, userDataDir);

    // Then use uv to download Python
    await downloadPythonWithUv(uvExecutable, platform, arch, userDataDir);

    // Finally install griptape-nodes
    await installGriptapeNodes(uvExecutable, userDataDir);

    console.log(`Successfully set up Python ${PYTHON_VERSION}, uv, and griptape-nodes for ${platform}-${arch}`);
  } catch (error) {
    console.error(`Failed to setup Python, uv, and griptape-nodes for ${platform}-${arch}:`, error);
    throw error;
  }
}

export function getPythonVersion(): string {
  return PYTHON_VERSION;
}

export function getUvPath(userDataPath: string, platform: string, arch: string): string {
  const uvInstallDir = getUvInstallDir(userDataPath);
  const uvDir = path.join(uvInstallDir, `${platform}-${arch}`);
  return path.join(uvDir, platform === 'win32' ? 'uv.exe' : 'uv');
}

export function getPythonInstallDir(userDataPath: string): string {
  return path.join(userDataPath, 'python');
}

export function getUvToolDir(appDataPath: string): string {
  return path.join(appDataPath, 'uv-tools');
}

export function getUvInstallDir(userDataPath: string): string {
  return path.join(userDataPath, 'uv');
}
