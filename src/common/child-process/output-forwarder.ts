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
    const stdoutLines: string[] = []
    const stderrLines: string[] = []

    // Store readline interfaces so we can close them
    let stdoutInterface: readline.Interface | undefined
    let stderrInterface: readline.Interface | undefined

    // stdout
    if (child.stdout) {
      stdoutInterface = readline.createInterface({ input: child.stdout })
      stdoutInterface.on('line', (line) => {
        logger.info(`[${logPrefix}] ${line}`)
        stdoutLines.push(line)
      })
    }

    // stderr
    if (child.stderr) {
      stderrInterface = readline.createInterface({ input: child.stderr })
      stderrInterface.on('line', (line) => {
        logger.error(`[${errorPrefix}] ${line}`)
        stderrLines.push(line)
      })
    }

    child.on('close', (code) => {
      // Clean up readline interfaces to allow process to exit
      stdoutInterface?.close()
      stderrInterface?.close()

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
      // Clean up readline interfaces on error too
      stdoutInterface?.close()
      stderrInterface?.close()
      reject(error)
    })
  })
}
