import { spawn, ChildProcess } from 'child_process'

export function collectStdout(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (err) => reject(err))

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`Python process exited with code ${code}. Stderr: ${stderr.trim()}`))
      }
    })
  })
}
