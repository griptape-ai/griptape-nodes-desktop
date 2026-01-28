// Mock fs module for testing
export const existsSync = jest.fn()
export const readFileSync = jest.fn()
export const writeFileSync = jest.fn()
export const mkdirSync = jest.fn()
export const statSync = jest.fn()
export const readdirSync = jest.fn()
export const rmSync = jest.fn()

// Reset all mocks
export function __resetMocks() {
  existsSync.mockReset()
  readFileSync.mockReset()
  writeFileSync.mockReset()
  mkdirSync.mockReset()
  statSync.mockReset()
  readdirSync.mockReset()
  rmSync.mockReset()
}
