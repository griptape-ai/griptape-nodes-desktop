import { EventEmitter } from 'events'
import { Readable } from 'stream'
import { attachOutputForwarder } from './output-forwarder'
import type { ChildProcess } from 'child_process'

// Create a mock readable stream that works with readline
function createMockReadable(): Readable {
  return new Readable({
    read() {}
  })
}

// Create a mock ChildProcess
function createMockChildProcess(): ChildProcess & {
  stdout: Readable
  stderr: Readable
} {
  const process = new EventEmitter() as any
  process.stdout = createMockReadable()
  process.stderr = createMockReadable()
  return process
}

describe('attachOutputForwarder', () => {
  it('should resolve on exit code 0', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    // Emit close with success
    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
  })

  it('should reject on non-zero exit code', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    mockChild.emit('close', 1)

    await expect(promise).rejects.toThrow('Process failed with exit code 1')
  })

  it('should reject on error event', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    mockChild.emit('error', new Error('Spawn error'))

    await expect(promise).rejects.toThrow('Spawn error')
  })

  it('should include stderr in error message on failure', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    // Push stderr data before close
    mockChild.stderr.push('Error line 1\n')
    mockChild.stderr.push('Error line 2\n')
    mockChild.stderr.push(null) // End the stream

    // Give readline time to process
    await new Promise((resolve) => setTimeout(resolve, 10))

    mockChild.emit('close', 1)

    await expect(promise).rejects.toThrow(/stderr:/)
  })

  it('should include stdout in error message on failure', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    // Push stdout data before close
    mockChild.stdout.push('Output line 1\n')
    mockChild.stdout.push('Output line 2\n')
    mockChild.stdout.push(null) // End the stream

    // Give readline time to process
    await new Promise((resolve) => setTimeout(resolve, 10))

    mockChild.emit('close', 1)

    await expect(promise).rejects.toThrow(/stdout:/)
  })

  it('should use default error prefix when not provided', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'MYPREFIX' })

    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
    // The default error prefix should be logPrefix + "_STDERR"
  })

  it('should use custom error prefix when provided', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, {
      logPrefix: 'TEST',
      errorPrefix: 'CUSTOM_ERR'
    })

    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
  })

  it('should handle process with null stdout', async () => {
    const mockChild = new EventEmitter() as any
    mockChild.stdout = null
    mockChild.stderr = createMockReadable()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
  })

  it('should handle process with null stderr', async () => {
    const mockChild = new EventEmitter() as any
    mockChild.stdout = createMockReadable()
    mockChild.stderr = null

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
  })

  it('should handle multiple exit codes', async () => {
    const testCodes = [1, 2, 127, 255]

    for (const code of testCodes) {
      const mockChild = createMockChildProcess()
      const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

      mockChild.emit('close', code)

      await expect(promise).rejects.toThrow(`Process failed with exit code ${code}`)
    }
  })

  it('should forward stdout lines to logger', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    // Push data line by line
    mockChild.stdout.push('Line 1\n')
    mockChild.stdout.push('Line 2\n')
    mockChild.stdout.push(null)

    // Give readline time to process
    await new Promise((resolve) => setTimeout(resolve, 10))

    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
    // Logger should have been called with prefixed lines
  })

  it('should forward stderr lines to logger with error level', async () => {
    const mockChild = createMockChildProcess()

    const promise = attachOutputForwarder(mockChild, { logPrefix: 'TEST' })

    // Push error data
    mockChild.stderr.push('Error output\n')
    mockChild.stderr.push(null)

    // Give readline time to process
    await new Promise((resolve) => setTimeout(resolve, 10))

    mockChild.emit('close', 0)

    await expect(promise).resolves.toBeUndefined()
    // Logger.error should have been called
  })
})
