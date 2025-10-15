import { ChildProcess } from 'child_process'
import readline from 'readline'
import { logger } from '@/main/utils/logger'

export interface OutputForwarderOptions {
  logPrefix: string
  errorPrefix?: string
}

export function attachOutputForwarder(
  child: ChildProcess,
  options: OutputForwarderOptions
): Promise<void> {
  const { logPrefix, errorPrefix = `${logPrefix}_STDERR` } = options

  return new Promise<void>((resolve, reject) => {
    // stdout
    if (child.stdout) {
      readline
        .createInterface({ input: child.stdout })
        .on('line', (line) => logger.info(`[${logPrefix}] ${line}`))
    }

    // stderr
    if (child.stderr) {
      readline
        .createInterface({ input: child.stderr })
        .on('line', (line) => logger.error(`[${errorPrefix}] ${line}`))
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Process failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}
