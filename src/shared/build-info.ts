import { execSync } from 'child_process';
import { readFileSync } from 'fs';

export const getBuildInfo = () => {
  // Get package.json version
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = packageJson.version;

  try {
    // Get git information with Windows-compatible options
    const commitHash = execSync('git rev-parse HEAD', { 
      encoding: 'utf8',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    const commitDate = execSync('git log -1 --format=%ci', { 
      encoding: 'utf8',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      encoding: 'utf8',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    return {
      version,
      commitHash,
      commitDate,
      branch,
      buildDate: new Date().toISOString(),
      buildId: Date.now().toString()
    };
  } catch (error) {
    console.warn('Failed to generate build info:', error);
    return {
      version,
      commitHash: 'unknown',
      commitDate: 'unknown',
      branch: 'unknown',
      buildDate: new Date().toISOString(),
      buildId: Date.now().toString()
    };
  }
};
