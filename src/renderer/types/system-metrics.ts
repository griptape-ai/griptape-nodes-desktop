export interface MemoryBreakdown {
  used: number
  cached: number
  available: number
  total: number
}

export interface GpuInfo {
  model: string
  usage: number
  memory: {
    used: number
    total: number
  }
}

export interface SystemMetrics {
  cpu: {
    usage: number
    model: string
  }
  memory: {
    used: number
    total: number
    percentage: number
    type: 'system' | 'unified'
    breakdown?: MemoryBreakdown
  }
  gpus: GpuInfo[]
}
