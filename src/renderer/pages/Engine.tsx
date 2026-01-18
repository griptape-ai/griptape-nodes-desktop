import Convert from 'ansi-to-html'
import React, { useEffect, useRef, useMemo, useCallback, memo, useState } from 'react'
import {
  Play,
  Square,
  RotateCcw,
  Download,
  Copy,
  Check,
  Trash2,
  Settings,
  ChevronRight
} from 'lucide-react'
import { useEngine } from '../contexts/EngineContext'
import { getStatusIcon, getStatusColor } from '../utils/engineStatusIcons'
import { cleanAnsiForDisplay, stripAnsiCodes } from '../utils/ansi'

const ansiConverter = new Convert({
  fg: '#e5e7eb',
  bg: 'transparent',
  newline: false,
  escapeXML: true,
  stream: false,
  colors: {
    0: '#000',
    1: '#dc2626',
    2: '#16a34a',
    3: '#ca8a04',
    4: '#2563eb',
    5: '#9333ea',
    6: '#0891b2',
    7: '#e5e7eb',
    8: '#6b7280',
    9: '#ef4444',
    10: '#22c55e',
    11: '#facc15',
    12: '#3b82f6',
    13: '#a855f7',
    14: '#06b6d4',
    15: '#f3f4f6'
  }
})

// Format timestamp for log display
const formatTimestamp = (timestamp: Date) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Log row component - defined outside Engine to prevent recreation on every render
interface LogRowProps {
  log: { timestamp: Date; type: string; message: string }
}

const LogRow = memo(({ log }: LogRowProps) => {
  const processedMessage = useMemo(() => {
    try {
      // Clean up ANSI cursor control codes and spinner characters
      let cleanMessage = cleanAnsiForDisplay(log.message)

      // Handle OSC 8 hyperlinks BEFORE ANSI conversion
      // Looking at the actual format: ]8;id=ID;URL\TEXT]8;;\
      const linkPlaceholders: { placeholder: string; html: string }[] = []
      let linkIndex = 0

      // Replace OSC 8 sequences with placeholders that won't be affected by ANSI conversion
      // Format: ]8;id=ID;URL\TEXT]8;;\
      cleanMessage = cleanMessage.replace(
        /\]8;[^;]*;([^\\]+)\\([^\]]+?)\]8;;\\?/g,
        (_, url, text) => {
          const placeholder = `__LINK_PLACEHOLDER_${linkIndex}__`
          linkIndex++

          // Clean up the text by removing ANSI color codes and control characters
          const cleanText = text
            // Remove ANSI color codes like [1;34m and [0m
            .replace(/\x1b?\[[0-9;]*m/g, '')
            // Remove control characters (including char code 26 - SUB character)
            .replace(/[\x00-\x1F\x7F]/g, '')
            // Remove any whitespace characters including non-breaking spaces
            .replace(/[\s\u00A0]+$/, '')
            .replace(/^[\s\u00A0]+/, '')
            .trim()

          // Use the URL as the display text if no clean text remains
          const displayText = cleanText || url

          linkPlaceholders.push({
            placeholder,
            html: `<a href="javascript:void(0)" data-external-url="${url}" class="text-blue-500 hover:text-blue-400 underline cursor-pointer" title="${url}">${displayText}</a>`
          })
          return placeholder
        }
      )

      // Clean up any orphaned backslashes that might appear after link placeholders
      cleanMessage = cleanMessage.replace(/__LINK_PLACEHOLDER_\d+__\s*\\/g, (match) => {
        return match.replace(/\\$/, '')
      })

      // Replace multiple spaces with non-breaking spaces to preserve formatting
      const messageWithPreservedSpaces = cleanMessage.replace(/ {2,}/g, (match) =>
        '\u00A0'.repeat(match.length)
      )

      // Convert ANSI to HTML
      let htmlMessage = ansiConverter.toHtml(messageWithPreservedSpaces)

      // Replace placeholders with actual links
      linkPlaceholders.forEach(({ placeholder, html }) => {
        htmlMessage = htmlMessage.replace(placeholder, html)
      })

      // Final cleanup: remove any trailing backslashes that might appear after links
      htmlMessage = htmlMessage.replace(/<\/a>\s*\\/g, '</a>')

      return { __html: htmlMessage }
    } catch {
      // Fallback: preserve spaces even without ANSI processing
      const messageWithPreservedSpaces = log.message.replace(/ {2,}/g, (match) =>
        '\u00A0'.repeat(match.length)
      )
      return { __html: messageWithPreservedSpaces }
    }
  }, [log.message])

  return (
    <div className="flex items-start px-4 hover:bg-gray-100 dark:hover:bg-gray-800">
      <span className="text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0 font-mono text-xs pt-0.5">
        {formatTimestamp(log.timestamp)}
      </span>
      <span
        className={`flex-1 font-mono text-sm leading-tight whitespace-pre-wrap break-words ${
          log.type === 'stderr' ? 'text-red-600 dark:text-red-400' : ''
        }`}
        dangerouslySetInnerHTML={processedMessage}
      />
    </div>
  )
})
LogRow.displayName = 'LogRow'

interface EngineProps {
  onNavigateToSettings?: () => void
}

const Engine: React.FC<EngineProps> = ({ onNavigateToSettings }) => {
  const { status, logs, isLoading, startEngine, stopEngine, restartEngine, clearLogs } = useEngine()
  const [isExporting, setIsExporting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [logFileEnabled, setLogFileEnabled] = useState(true) // Default matches settings-service default
  const [commandInput, setCommandInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportType, setExportType] = useState<'session' | 'days'>('session')
  const [exportDays, setExportDays] = useState(1)
  const [logDateRange, setLogDateRange] = useState<{
    oldestDate: string
    newestDate: string
    availableDays: number
  } | null>(null)
  // Log controls collapsed state
  const [logControlsCollapsed, setLogControlsCollapsed] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const wasAtBottomRef = useRef(true)
  const prevLogCountRef = useRef(0)

  // Handle clicks on external links in logs
  useEffect(() => {
    const handleLinkClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement

      if (target.tagName === 'A' && target.dataset.externalUrl) {
        e.preventDefault()
        e.stopPropagation()

        const url = target.dataset.externalUrl

        if (window.electronAPI?.openExternal && url) {
          try {
            await window.electronAPI.openExternal(url)
          } catch (error) {
            console.error('Failed to open external URL:', error)
          }
        }
      }
    }

    const container = logsContainerRef.current
    if (container) {
      container.addEventListener('click', handleLinkClick)
      return () => container.removeEventListener('click', handleLinkClick)
    }
  }, [logs])

  // Auto-scroll to bottom when new logs arrive if user was at bottom
  useEffect(() => {
    // Detect if new logs were added
    const logsAdded = logs.length > prevLogCountRef.current
    prevLogCountRef.current = logs.length

    if (listRef.current && logs.length > 0) {
      // Always scroll to bottom on initial load or when new logs are added and we're at bottom
      if (logsAdded && wasAtBottomRef.current) {
        // Double RAF to ensure div has re-rendered with new items
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight
            }
          })
        })
      }
    }
  }, [logs.length]) // Only re-run when count changes

  // Force scroll to bottom on mount after div is ready
  useEffect(() => {
    wasAtBottomRef.current = true
    const timer = setInterval(() => {
      if (listRef.current && logs.length > 0) {
        listRef.current.scrollTop = listRef.current.scrollHeight
        clearInterval(timer)
      }
    }, 100)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load log file enabled setting
  useEffect(() => {
    const loadLogFileSetting = async () => {
      try {
        const enabled = await window.settingsAPI.getEngineLogFileEnabled()
        setLogFileEnabled(enabled)
      } catch (err) {
        console.error('Failed to load log file setting:', err)
      }
    }
    loadLogFileSetting()
  }, [])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    if (target) {
      const { scrollTop, scrollHeight, clientHeight } = target
      // More lenient bottom detection - within 50px of bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      wasAtBottomRef.current = isAtBottom
    }
  }, [])

  const copyLogsToClipboard = useCallback(async () => {
    try {
      const plainTextLogs = logs
        .map((log) => {
          return `${formatTimestamp(log.timestamp)} | ${stripAnsiCodes(log.message)}`
        })
        .join('\n')

      await navigator.clipboard.writeText(plainTextLogs)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy logs to clipboard:', error)
    }
  }, [logs])

  const handleOpenExportModal = useCallback(async () => {
    // Fetch log date range when opening modal
    try {
      const dateRange = await window.engineAPI.getLogDateRange()
      setLogDateRange(dateRange)
      if (dateRange) {
        setExportDays(Math.min(dateRange.availableDays, 7)) // Default to 7 days or max available
      }
    } catch (error) {
      console.error('Failed to get log date range:', error)
    }
    setShowExportModal(true)
  }, [])

  const handleExportLogs = useCallback(async () => {
    setIsExporting(true)
    setShowExportModal(false)
    try {
      const options =
        exportType === 'session'
          ? { type: 'session' as const }
          : { type: 'days' as const, days: exportDays }
      const result = await window.engineAPI.exportLogs(options)
      if (!result.success && result.error) {
        console.error('Failed to export logs:', result.error)
      }
    } catch (error) {
      console.error('Failed to export logs:', error)
    } finally {
      setIsExporting(false)
    }
  }, [exportType, exportDays])

  const handleExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isExecuting) {
      return
    }

    // Keep focus on the input
    const inputElement = commandInputRef.current
    if (inputElement) {
      inputElement.focus()
    }

    setIsExecuting(true)

    try {
      const result = await window.engineAPI.runCommand(commandInput)

      if (!result.success && result.error) {
        console.error('Command failed:', result.error)
      }

      if (result.success) {
        setCommandInput('')
      }
    } catch (error) {
      console.error('Failed to execute command:', error)
    } finally {
      setIsExecuting(false)
      // Ensure focus is maintained after command execution
      setTimeout(() => {
        inputElement?.focus()
      }, 0)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden mx-auto">
      {/* Compact Status Bar - Sticky */}
      <div className="flex-shrink-0 bg-card border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        {/* Left side: Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Engine</span>
          <div className="flex items-center gap-2">
            {getStatusIcon(status, 'sm')}
            <span className={`text-sm font-medium ${getStatusColor(status)}`}>
              {status === 'ready'
                ? 'Stopped'
                : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            </span>
          </div>
        </div>

        {/* Right side: Engine Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={startEngine}
            disabled={
              isLoading ||
              status === 'running' ||
              status === 'not-ready' ||
              status === 'initializing'
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
          <button
            onClick={stopEngine}
            disabled={isLoading || status !== 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
          <button
            onClick={restartEngine}
            disabled={
              isLoading || status === 'not-ready' || status == 'ready' || status === 'initializing'
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      </div>

      {/* Status Messages (if needed) */}
      {status === 'not-ready' && (
        <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            The engine is not ready. Please ensure Griptape Nodes is installed and initialized.
          </p>
        </div>
      )}

      {status === 'initializing' && (
        <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            Setting up Griptape Nodes environment...
          </p>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden relative">
            <div
              className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full absolute"
              style={{
                width: '40%',
                animation: 'indeterminate 1.5s ease-in-out infinite'
              }}
            />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Error</p>
          <p className="text-sm text-red-800 dark:text-red-200 mb-2 whitespace-pre-wrap break-words font-mono">
            {(() => {
              // Find the most recent stderr log entry
              const lastError = [...logs]
                .reverse()
                .find((log) => log.type === 'stderr' && log.message.trim())
              if (lastError) {
                return stripAnsiCodes(lastError.message)
              }
              return 'An error occurred during engine initialization.'
            })()}
          </p>
          <p className="text-xs text-red-700 dark:text-red-300">
            Check the logs below for details.
          </p>
        </div>
      )}

      {/* Logs Container - Scrollable */}
      <div className="flex-1 min-h-0 px-6 pt-2 pb-4">
        <div
          ref={logsContainerRef}
          className="bg-gray-900 dark:bg-black rounded-lg h-full overflow-hidden relative"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              No logs available
            </div>
          ) : (
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="terminal-scrollbar h-full w-full overflow-y-auto"
              style={{
                backgroundColor: 'rgb(17 24 39)',
                color: '#e5e7eb'
              }}
            >
              {logs.map((log, index) => (
                <LogRow key={`${new Date(log.timestamp).getTime()}-${index}`} log={log} />
              ))}
            </div>
          )}
          {/* Log Controls - Overlay (Collapsible) */}
          <div className="absolute bottom-2 right-2 flex items-center bg-gray-800 rounded-md p-1 transition-all duration-200">
            {/* Collapse Toggle */}
            <button
              onClick={() => setLogControlsCollapsed(!logControlsCollapsed)}
              className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-white transition-colors"
              title={logControlsCollapsed ? 'Expand controls' : 'Collapse controls'}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${logControlsCollapsed ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Collapsible Buttons */}
            <div
              className={`flex items-center gap-2 overflow-hidden transition-all duration-200 ${
                logControlsCollapsed ? 'max-w-0 opacity-0' : 'max-w-[500px] opacity-100 ml-1'
              }`}
            >
              <button
                onClick={copyLogsToClipboard}
                disabled={logs.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={clearLogs}
                disabled={logs.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
              <div className="h-5 w-px bg-gray-600 mx-1" />
              {logFileEnabled ? (
                <button
                  onClick={handleOpenExportModal}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    title="Enable 'Write engine logs to file' in Settings to export logs"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md opacity-50 cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  <button
                    onClick={() => {
                      onNavigateToSettings?.()
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('scroll-to-logging'))
                      }, 100)
                    }}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Settings className="w-3 h-3" />
                    Manage
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Input */}
      <div className="flex-shrink-0 px-6 py-3 border-t border-border">
        <form onSubmit={handleExecuteCommand} className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
              $
            </span>
            <input
              ref={commandInputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Enter GTN command or respond to prompt (try 'gtn --help')"
              disabled={isExecuting}
              className="w-full pl-8 pr-3 py-2 bg-muted border border-border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={isExecuting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        </form>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Export Logs</h3>

            <div className="space-y-4">
              {/* Export Type Selection */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="exportType"
                    value="session"
                    checked={exportType === 'session'}
                    onChange={() => setExportType('session')}
                    className="mt-1 w-4 h-4 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Current Session</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Export logs from the current session
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="exportType"
                    value="days"
                    checked={exportType === 'days'}
                    onChange={() => setExportType('days')}
                    disabled={!logDateRange}
                    className="mt-1 w-4 h-4 text-primary focus:ring-primary disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span
                      className={`text-sm font-medium ${!logDateRange ? 'text-muted-foreground' : ''}`}
                    >
                      From Log Files
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {logDateRange
                        ? `Export logs from the past ${exportDays} day${exportDays > 1 ? 's' : ''}`
                        : 'No saved log files available'}
                    </p>
                  </div>
                </label>
              </div>

              {/* Days Slider - only shown when "days" is selected and logs are available */}
              {exportType === 'days' && logDateRange && logDateRange.availableDays > 1 && (
                <div className="pl-7 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Days to export:</span>
                    <span className="font-medium">{exportDays}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={logDateRange.availableDays}
                    value={exportDays}
                    onChange={(e) => setExportDays(parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 day</span>
                    <span>{logDateRange.availableDays} days</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportLogs}
                disabled={exportType === 'days' && !logDateRange}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Engine
