import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream } from 'fs';
import { execSync } from 'child_process';

const PYTHON_VERSION = '3.12.7';

// Default resources path for build-time operations
function getBuildTimeResourcesPath(): string {
  return path.join(process.cwd(), 'resources');
}

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
      // Extract to a temporary directory first
      const tempExtractPath = path.join(path.dirname(extractPath), 'temp_uv_extract');
      if (fs.existsSync(tempExtractPath)) {
        fs.rmSync(tempExtractPath, { recursive: true, force: true });
      }
      fs.mkdirSync(tempExtractPath, { recursive: true });
      
      // Add a small delay to ensure file is not locked, then use different PowerShell approach
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Use System.IO.Compression instead of Expand-Archive to avoid file lock issues
        execSync(`powershell -command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${archivePath}', '${tempExtractPath}')"`, { stdio: 'inherit' });
      } catch (psError) {
        console.log('PowerShell extraction failed, trying alternative method...');
        // Fallback to node.js built-in if available, or try different command
        execSync(`powershell -command "$archive = '${archivePath}'; $dest = '${tempExtractPath}'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($archive, $dest)"`, { stdio: 'inherit' });
      }
      
      // Wait for extraction to fully complete and file handles to be released
      console.log(`Extraction completed, waiting for file system operations to settle...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify extraction directory exists and is accessible
      let retries = 0;
      const maxRetries = 5;
      while (retries < maxRetries) {
        try {
          if (fs.existsSync(tempExtractPath) && fs.readdirSync(tempExtractPath).length > 0) {
            break;
          }
        } catch (error) {
          console.log(`Extraction directory not ready, waiting... (attempt ${retries + 1}/${maxRetries})`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }
      
      if (retries === maxRetries) {
        throw new Error('Extraction directory not accessible after multiple attempts');
      }
      
      console.log(`Extraction verified, looking for uv.exe in ${tempExtractPath}`);
      
      // Find the uv.exe file in the extracted contents with better debugging
      let uvExePath: string | null = null;
      
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
      
      uvExePath = findUvRecursive(tempExtractPath);
      
      if (!uvExePath) {
        console.error('UV executable not found. Archive contents:');
        execSync(`powershell -command "Get-ChildItem -Path '${tempExtractPath}' -Recurse | Format-Table Name,FullName"`, { stdio: 'inherit' });
        throw new Error('uv.exe not found in extracted archive');
      }
      
      // Wait for uv.exe to be fully available before copying
      console.log(`Found uv.exe at ${uvExePath}, verifying file is ready...`);
      let copyRetries = 0;
      const maxCopyRetries = 3;
      while (copyRetries < maxCopyRetries) {
        try {
          // Check if file is readable and not locked
          const stats = fs.statSync(uvExePath);
          if (stats.size > 0) {
            break;
          }
        } catch (error) {
          console.log(`uv.exe not ready for copy, waiting... (attempt ${copyRetries + 1}/${maxCopyRetries})`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        copyRetries++;
      }
      
      const targetPath = path.join(extractPath, 'uv.exe');
      console.log(`Copying uv.exe from ${uvExePath} to ${targetPath}`);
      fs.copyFileSync(uvExePath, targetPath);
      
      // Clean up temp directory
      fs.rmSync(tempExtractPath, { recursive: true, force: true });
    } else if (archivePath.endsWith('.tar.gz')) {
      execSync(`tar -xzf "${archivePath}" -C "${extractPath}" --strip-components=1`, { stdio: 'inherit' });
    }
  } catch (error) {
    console.error('UV extraction failed:', error);
    throw error;
  }
}

async function downloadAndExtractUv(platform: string, arch: string): Promise<string> {
  const build = UV_BUILDS[platform]?.[arch];
  if (!build) {
    throw new Error(`No uv build available for ${platform}-${arch}`);
  }

  const resourcesDir = getBuildTimeResourcesPath();
  const uvDir = path.join(resourcesDir, 'uv', `${platform}-${arch}`);
  const archivePath = path.join(resourcesDir, 'uv', build.filename);
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
    execSync(`chmod +x "${uvExecutable}"`);
  }
  
  // Clean up archive
  fs.unlinkSync(archivePath);
  
  console.log(`uv extracted to: ${uvExecutable}`);
  return uvExecutable;
}

async function downloadPythonWithUv(uvExecutable: string, platform: string, arch: string): Promise<void> {
  console.log(`Using uv to install Python ${PYTHON_VERSION} for ${platform}-${arch}...`);
  
  try {
    // Set UV_PYTHON_INSTALL_DIR to our resources directory (build time)
    const env = { 
      ...process.env, 
      UV_PYTHON_INSTALL_DIR: getPythonInstallDir(getBuildTimeResourcesPath())
    };
    
    // Install Python using uv
    execSync(`"${uvExecutable}" python install ${PYTHON_VERSION}`, { 
      stdio: 'inherit',
      env 
    });
    
    console.log(`Successfully installed Python ${PYTHON_VERSION} using uv`);
  } catch (error) {
    console.error(`Failed to install Python with uv:`, error);
    throw error;
  }
}

async function installGriptapeNodes(uvExecutable: string): Promise<void> {
  console.log('Installing griptape-nodes tool...');
  
  try {
    const resourcesPath = getBuildTimeResourcesPath();
    const toolDir = getUvToolDir(resourcesPath);
    const env = { 
      ...process.env, 
      UV_PYTHON_INSTALL_DIR: getPythonInstallDir(resourcesPath),
      UV_TOOL_DIR: toolDir,
      UV_TOOL_BIN_DIR: path.join(toolDir, 'bin')
    };
    
    // Install griptape-nodes using uv
    try {
      execSync(`"${uvExecutable}" tool install griptape-nodes`, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        env 
      });
    } catch (error: any) {
      console.error('uv tool install failed with error:', error.message);
      if (error.stdout) console.error('stdout:', error.stdout.toString());
      if (error.stderr) console.error('stderr:', error.stderr.toString());
      throw error;
    }
    
    console.log('Successfully installed griptape-nodes tool');
  } catch (error) {
    console.error('Failed to install griptape-nodes tool:', error);
    throw error;
  }
}

export async function downloadPython(platform: string, arch: string): Promise<void> {
  try {
    // First download and extract uv
    const uvExecutable = await downloadAndExtractUv(platform, arch);
    
    // Then use uv to download Python
    await downloadPythonWithUv(uvExecutable, platform, arch);
    
    console.log(`Successfully set up Python ${PYTHON_VERSION} and uv for ${platform}-${arch}`);
  } catch (error) {
    console.error(`Failed to setup Python and uv for ${platform}-${arch}:`, error);
    throw error;
  }
}

export function getPythonVersion(): string {
  return PYTHON_VERSION;
}

export function getUvPath(resourcesPath: string, platform: string, arch: string): string {
  const uvDir = path.join(resourcesPath, 'uv', `${platform}-${arch}`);
  return path.join(uvDir, platform === 'win32' ? 'uv.exe' : 'uv');
}

export function getPythonInstallDir(resourcesPath: string): string {
  return path.join(resourcesPath, 'python');
}

export function getUvToolDir(resourcesPath: string): string {
  return path.join(resourcesPath, 'uv-tools');
}