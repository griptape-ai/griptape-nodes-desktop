import React, { useState, useEffect, useRef } from 'react';
import { useEngine } from '../contexts/EngineContext';

const Engine: React.FC = () => {
  const { status, logs, isLoading, startEngine, stopEngine, restartEngine, clearLogs } = useEngine();
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);


  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);


  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'text-green-600 dark:text-green-400';
      case 'ready':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusDot = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500';
      case 'ready':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Status Card */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Engine Status</h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getStatusDot()} animate-pulse`}></div>
            <span className={`font-medium ${getStatusColor()}`}>
              {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            </span>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="flex gap-3">
          <button
            onClick={startEngine}
            disabled={isLoading || status === 'running' || status === 'not-ready'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Engine
          </button>
          <button
            onClick={stopEngine}
            disabled={isLoading || status !== 'running'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Stop Engine
          </button>
          <button
            onClick={restartEngine}
            disabled={isLoading || status === 'not-ready'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Restart Engine
          </button>
        </div>

        {status === 'not-ready' && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              The engine is not ready. Please ensure Griptape Nodes is installed and initialized.
            </p>
          </div>
        )}
      </div>

      {/* Logs Card */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Engine Logs</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Logs Container */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              No logs available
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex">
                  <span className="text-gray-500 dark:text-gray-400 mr-3">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={`flex-1 whitespace-pre-wrap break-all ${
                      log.type === 'stderr' 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Engine;