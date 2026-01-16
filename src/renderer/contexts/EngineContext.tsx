import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback
} from 'react'
import type { EngineStatus, EngineLog, IpcEvent } from '@/types/global'
import { getErrorMessage } from '@/common/utils/error'

export interface OperationMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

interface EngineContextType {
  status: EngineStatus
  logs: EngineLog[]
  isLoading: boolean
  isUpgradePending: boolean
  operationMessage: OperationMessage | null
  setIsUpgradePending: (pending: boolean) => void
  setOperationMessage: (message: OperationMessage | null) => void
  clearOperationMessage: () => void
  startEngine: () => Promise<void>
  stopEngine: () => Promise<void>
  restartEngine: () => Promise<void>
  reinstallEngine: () => Promise<void>
  clearLogs: () => Promise<void>
  refreshStatus: () => Promise<void>
}

const EngineContext = createContext<EngineContextType | undefined>(undefined)

export const useEngine = () => {
  const context = useContext(EngineContext)
  if (!context) {
    throw new Error('useEngine must be used within an EngineProvider')
  }
  return context
}

interface EngineProviderProps {
  children: ReactNode
}

export const EngineProvider: React.FC<EngineProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<EngineStatus>('not-ready')
  const [logs, setLogs] = useState<EngineLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpgradePending, setIsUpgradePending] = useState(false)
  const [operationMessage, setOperationMessage] = useState<OperationMessage | null>(null)
  const maxLogSize = 1000 // Keep last 1000 log entries (matching main process limit)

  // Fetch initial status and logs
  useEffect(() => {
    let mounted = true
    let isInitialLoad = true

    const fetchInitialData = async () => {
      try {
        const currentStatus = await window.engineAPI.getStatus()
        const currentLogs = await window.engineAPI.getLogs()

        if (mounted) {
          setStatus(currentStatus)
          // Trim initial logs if they exceed max size
          setLogs(currentLogs.length > maxLogSize ? currentLogs.slice(-maxLogSize) : currentLogs)
          setTimeout(() => {
            isInitialLoad = false
          }, 100)
        }
      } catch (error) {
        console.error('Failed to fetch engine data:', error)
      }
    }

    // Set up event listeners
    const handleStatusChange = (_event: IpcEvent, newStatus: EngineStatus) => {
      if (mounted) {
        setStatus(newStatus)
      }
    }

    const handleNewLog = (_event: IpcEvent, log: EngineLog) => {
      if (mounted && !isInitialLoad) {
        setLogs((prev) => {
          const exists = prev.some(
            (existingLog) =>
              existingLog.message === log.message &&
              Math.abs(
                new Date(existingLog.timestamp).getTime() - new Date(log.timestamp).getTime()
              ) < 100
          )
          if (!exists) {
            const newLogs = [...prev, log]
            // Trim logs if they exceed max size to prevent unbounded memory growth
            if (newLogs.length > maxLogSize) {
              return newLogs.slice(-maxLogSize)
            }
            return newLogs
          }
          return prev
        })
      }
    }

    window.engineAPI.onStatusChanged(handleStatusChange)
    window.engineAPI.onLog(handleNewLog)

    fetchInitialData()

    return () => {
      mounted = false
      window.engineAPI.removeStatusChanged(handleStatusChange)
      window.engineAPI.removeLog(handleNewLog)
    }
  }, [])

  const startEngine = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.engineAPI.start()
      if (!result.success) {
        console.error('Failed to start engine:', result.error)
      }
    } catch (error) {
      console.error('Error starting engine:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const stopEngine = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.engineAPI.stop()
      if (!result.success) {
        console.error('Failed to stop engine:', result.error)
      }
    } catch (error) {
      console.error('Error stopping engine:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const restartEngine = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.engineAPI.restart()
      if (!result.success) {
        console.error('Failed to restart engine:', result.error)
      }
    } catch (error) {
      console.error('Error restarting engine:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reinstallEngine = useCallback(async () => {
    setIsLoading(true)
    setOperationMessage({ type: 'info', text: 'Reinstalling engine stack...' })
    try {
      const result = await window.engineAPI.reinstall()
      if (result.success) {
        setOperationMessage({ type: 'success', text: 'Engine stack reinstalled successfully' })
      } else {
        console.error('Failed to reinstall engine:', result.error)
        setOperationMessage({
          type: 'error',
          text: `Failed to reinstall engine: ${result.error}`
        })
      }
    } catch (error) {
      console.error('Error reinstalling engine:', error)
      setOperationMessage({
        type: 'error',
        text: `Error reinstalling engine: ${getErrorMessage(error)}`
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearLogs = useCallback(async () => {
    try {
      await window.engineAPI.clearLogs()
      setLogs([])
    } catch (error) {
      console.error('Error clearing logs:', error)
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const currentStatus = await window.engineAPI.getStatus()
      setStatus(currentStatus)
    } catch (error) {
      console.error('Failed to refresh engine status:', error)
    }
  }, [])

  const clearOperationMessage = useCallback(() => {
    setOperationMessage(null)
  }, [])

  const contextValue = useMemo(
    () => ({
      status,
      logs,
      isLoading,
      isUpgradePending,
      operationMessage,
      setIsUpgradePending,
      setOperationMessage,
      clearOperationMessage,
      startEngine,
      stopEngine,
      restartEngine,
      reinstallEngine,
      clearLogs,
      refreshStatus
    }),
    [
      status,
      logs,
      isLoading,
      isUpgradePending,
      operationMessage,
      startEngine,
      stopEngine,
      restartEngine,
      reinstallEngine,
      clearLogs,
      refreshStatus,
      clearOperationMessage
    ]
  )

  return <EngineContext.Provider value={contextValue}>{children}</EngineContext.Provider>
}
