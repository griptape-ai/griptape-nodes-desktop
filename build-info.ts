import { execSync } from 'child_process'
import * as fs from 'fs'

interface BuildInfo {
  version: string
  commitHash: string
  commitDate: string
  branch: string
  buildDate: string
  buildId: string
}
// Simple function to get build info without requiring the TS module
export function getBuildInfo(): BuildInfo {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const version = packageJson.version

  try {
    const commitHash = execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()

    const commitDate = execSync('git log -1 --format=%ci', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()

    return {
      version,
      commitHash,
      commitDate,
      branch,
      buildDate: new Date().toISOString(),
      buildId: Date.now().toString()
    }
  } catch {
    return {
      version,
      commitHash: 'unknown',
      commitDate: 'unknown',
      branch: 'unknown',
      buildDate: new Date().toISOString(),
      buildId: Date.now().toString()
    }
  }
}
