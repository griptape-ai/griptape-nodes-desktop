export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  fatal: (err: Error | string) => void
}
