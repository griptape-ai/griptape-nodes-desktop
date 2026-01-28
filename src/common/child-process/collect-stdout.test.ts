import { EventEmitter } from 'events'
import { collectStdout } from './collect-stdout'
import type { ChildProcess } from 'child_process'

// Create a mock ChildProcess using EventEmitter
function createMockChildProcess(): ChildProcess & {
  stdout: EventEmitter & { on: jest.Mock }
  stderr: EventEmitter & { on: jest.Mock }
} {
  const process = new EventEmitter() as any
  process.stdout = new EventEmitter()
  process.stderr = new EventEmitter()
  return process
}

describe('collectStdout', () => {
  it('should collect stdout data', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    // Emit stdout data
    mockChild.stdout.emit('data', Buffer.from('Hello'))
    mockChild.stdout.emit('data', Buffer.from(' World'))

    // Emit close with success
    mockChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('Hello World')
  })

  it('should trim the output', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    mockChild.stdout.emit('data', Buffer.from('  content with whitespace  \n'))
    mockChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('content with whitespace')
  })

  it('should return empty string when no output', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)
    mockChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('')
  })

  it('should collect stderr but not include in result', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    mockChild.stdout.emit('data', Buffer.from('stdout data'))
    mockChild.stderr.emit('data', Buffer.from('stderr data'))
    mockChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('stdout data')
    expect(result).not.toContain('stderr')
  })

  it('should reject on non-zero exit code', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    mockChild.stderr.emit('data', Buffer.from('Error message'))
    mockChild.emit('close', 1)

    await expect(promise).rejects.toThrow('Python process exited with code 1')
  })

  it('should include stderr in rejection message', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    mockChild.stderr.emit('data', Buffer.from('Detailed error message'))
    mockChild.emit('close', 1)

    await expect(promise).rejects.toThrow('Stderr: Detailed error message')
  })

  it('should reject on error event', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    const error = new Error('Spawn failed')
    mockChild.emit('error', error)

    await expect(promise).rejects.toThrow('Spawn failed')
  })

  it('should handle string data in buffers', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    // Emit data as strings (simulating some scenarios)
    mockChild.stdout.emit('data', 'String data')
    mockChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('String data')
  })

  it('should handle multiple chunks of data', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    mockChild.stdout.emit('data', Buffer.from('Line 1\n'))
    mockChild.stdout.emit('data', Buffer.from('Line 2\n'))
    mockChild.stdout.emit('data', Buffer.from('Line 3'))
    mockChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('Line 1\nLine 2\nLine 3')
  })

  it('should handle exit code 0 specifically', async () => {
    const mockChild = createMockChildProcess()

    const promise = collectStdout(mockChild)

    mockChild.stdout.emit('data', Buffer.from('success'))
    mockChild.emit('close', 0)

    await expect(promise).resolves.toBe('success')
  })

  it('should reject for any non-zero exit code', async () => {
    const testCodes = [1, 2, 127, 255, -1]

    for (const code of testCodes) {
      const mockChild = createMockChildProcess()
      const promise = collectStdout(mockChild)

      mockChild.emit('close', code)

      await expect(promise).rejects.toThrow(`Python process exited with code ${code}`)
    }
  })

  it('should handle null stdout/stderr', async () => {
    const mockChild = new EventEmitter() as any
    mockChild.stdout = null
    mockChild.stderr = null

    const promise = collectStdout(mockChild)
    mockChild.emit('close', 0)

    // Should not throw and return empty string
    const result = await promise
    expect(result).toBe('')
  })
})
