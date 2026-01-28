import { ChildProcess } from 'child_process'
import readline from 'readline'
import { logger } from '@/main/utils/logger'

export interface OutputForwarderOptions {
  logPrefix: string
  errorPrefix?: string
}

export function attachOutputForwarder(
  child: ChildProcess,
  options: OutputForwarderOptions,
): Promise<void> {
  const { logPrefix, errorPrefix = `${logPrefix}_STDERR` } = options

  return new Promise<void>((resolve, reject) => {
    const stdoutLines: string[] = []
    const stderrLines: string[] = []

    // stdout
    if (child.stdout) {
      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        logger.info(`[${logPrefix}] ${line}`)
        stdoutLines.push(line)
      })
    }

    // stderr
    if (child.stderr) {
      readline.createInterface({ input: child.stderr }).on('line', (line) => {
        logger.error(`[${errorPrefix}] ${line}`)
        stderrLines.push(line)
      })
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        let errorMessage = `Process failed with exit code ${code}`

        if (stderrLines.length > 0) {
          errorMessage += '\n\nstderr:\n' + stderrLines.join('\n')
        }

        if (stdoutLines.length > 0) {
          errorMessage += '\n\nstdout:\n' + stdoutLines.join('\n')
        }

        reject(new Error(errorMessage))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}
