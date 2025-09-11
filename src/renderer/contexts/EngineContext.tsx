import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import type { EngineStatus, EngineLog } from '../../common/types/global';

interface EngineContextType {
  status: EngineStatus;
  logs: EngineLog[];
  isLoading: boolean;
  startEngine: () => Promise<void>;
  stopEngine: () => Promise<void>;
  restartEngine: () => Promise<void>;
  clearLogs: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export const useEngine = () => {
  const context = useContext(EngineContext);
  if (!context) {
    throw new Error('useEngine must be used within an EngineProvider');
  }
  return context;
};

interface EngineProviderProps {
  children: ReactNode;
}

export const EngineProvider: React.FC<EngineProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<EngineStatus>('not-ready');
  const [logs, setLogs] = useState<EngineLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial status and logs
  useEffect(() => {
    let mounted = true;
    let isInitialLoad = true;

    const fetchInitialData = async () => {
      try {
        const currentStatus = await window.engineAPI.getStatus();
        const currentLogs = await window.engineAPI.getLogs();

        if (mounted) {
          setStatus(currentStatus);
          setLogs(currentLogs);
          setTimeout(() => {
            isInitialLoad = false;
          }, 100);
        }
      } catch (error) {
        console.error('Failed to fetch engine data:', error);
      }
    };

    // Set up event listeners
    const handleStatusChange = (_event: any, newStatus: EngineStatus) => {
      if (mounted) {
        setStatus(newStatus);
      }
    };

    const handleNewLog = (_event: any, log: EngineLog) => {
      if (mounted && !isInitialLoad) {
        setLogs(prev => {
          const exists = prev.some(
            existingLog =>
              existingLog.message === log.message &&
              Math.abs(new Date(existingLog.timestamp).getTime() - new Date(log.timestamp).getTime()) < 100
          );
          if (!exists) {
            return [...prev, log];
          }
          return prev;
        });
      }
    };

    window.engineAPI.onStatusChanged(handleStatusChange);
    window.engineAPI.onLog(handleNewLog);

    fetchInitialData();

    return () => {
      mounted = false;
      window.engineAPI.removeStatusChanged(handleStatusChange);
      window.engineAPI.removeLog(handleNewLog);
    };
  }, []);

  const startEngine = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.engineAPI.start();
      if (!result.success) {
        console.error('Failed to start engine:', result.error);
      }
    } catch (error) {
      console.error('Error starting engine:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopEngine = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.engineAPI.stop();
      if (!result.success) {
        console.error('Failed to stop engine:', result.error);
      }
    } catch (error) {
      console.error('Error stopping engine:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restartEngine = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.engineAPI.restart();
      if (!result.success) {
        console.error('Failed to restart engine:', result.error);
      }
    } catch (error) {
      console.error('Error restarting engine:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await window.engineAPI.clearLogs();
      setLogs([]);
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const currentStatus = await window.engineAPI.getStatus();
      setStatus(currentStatus);
    } catch (error) {
      console.error('Failed to refresh engine status:', error);
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      status,
      logs,
      isLoading,
      startEngine,
      stopEngine,
      restartEngine,
      clearLogs,
      refreshStatus,
    }),
    [status, logs, isLoading, startEngine, stopEngine, restartEngine, clearLogs, refreshStatus]
  );

  return (
    <EngineContext.Provider value={contextValue}>
      {children}
    </EngineContext.Provider>
  );
};