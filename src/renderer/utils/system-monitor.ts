// Threshold percentages for color coding
const WARNING_THRESHOLD = 60
const CRITICAL_THRESHOLD = 90

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`
}

export function formatMemory(gb: number): string {
  return `${gb.toFixed(1)} GB`
}

export function getUsageBarColor(percentage: number): string {
  if (percentage >= CRITICAL_THRESHOLD) return 'bg-red-500'
  if (percentage >= WARNING_THRESHOLD) return 'bg-yellow-500'
  return 'bg-green-500'
}

export function getUsageTextColor(percentage: number): string {
  if (percentage >= CRITICAL_THRESHOLD) return 'text-red-500'
  if (percentage >= WARNING_THRESHOLD) return 'text-yellow-500'
  return 'text-green-500'
}

export function clampPercentage(value: number): number {
  return Math.min(Math.max(value, 0), 100)
}

export function calculateAverageGpuUsage(gpus: Array<{ usage: number }>): number {
  const validGpus = gpus.filter((gpu) => gpu.usage >= 0)
  if (validGpus.length === 0) return 0
  return validGpus.reduce((sum, gpu) => sum + gpu.usage, 0) / validGpus.length
}
