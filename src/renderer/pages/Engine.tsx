import Convert from 'ansi-to-html'
import React, { useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { List, type RowComponentProps } from 'react-window'
import { Play, Square, RotateCcw } from 'lucide-react'
import { useEngine } from '../contexts/EngineContext'
import { getStatusIcon, getStatusColor } from '../utils/engineStatusIcons'

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

const Engine: React.FC = () => {
  const { status, logs, isLoading, startEngine, stopEngine, restartEngine, clearLogs } = useEngine()
  const listRef = useRef<any>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)
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
        // Double RAF to ensure List has re-rendered with new items
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToRow({
              index: logs.length - 1,
              align: 'end',
              behavior: 'instant'
            })
          })
        })
      }
    }
  }, [logs.length]) // Only re-run when count changes

  // Force scroll to bottom on mount after List is ready
  useEffect(() => {
    wasAtBottomRef.current = true
    const timer = setInterval(() => {
      if (listRef.current && logs.length > 0) {
        listRef.current.scrollToRow({
          index: logs.length - 1,
          align: 'end',
          behavior: 'instant'
        })
        clearInterval(timer)
      }
    }, 100)

    return () => clearInterval(timer)
  }, [logs.length])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    if (target) {
      const { scrollTop, scrollHeight, clientHeight } = target
      // More lenient bottom detection - within 50px of bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
      wasAtBottomRef.current = isAtBottom
    }
  }, [])

  const formatTimestamp = useCallback((timestamp: Date) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }, [])

  const getItemSize = useCallback(() => {
    // Reduced height for tighter spacing
    return 20
  }, [])

  const LogRow = memo(
    ({ index, style, logs: logList }: RowComponentProps<{ logs: typeof logs }>) => {
      const log = logList[index]

      const processedMessage = useMemo(() => {
        try {
          // Clean up ANSI cursor control codes and spinner characters
          let cleanMessage = log.message
            // Remove cursor show/hide codes
            .replace(/\x1b\[\?25[lh]/g, '')
            // Remove cursor position codes
            .replace(/\x1b\[\d*[A-G]/g, '')
            // Remove Windows-specific cursor positioning
            .replace(/\x1b\[\d+;\d+[HfRr]/g, '')
            // Handle Windows CRLF line endings
            .replace(/\r\n/g, '\n')
            // Remove carriage returns that cause overwriting
            .replace(/\r(?!\n)/g, '')
            // Replace spinner characters with a simple indicator
            .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '•')

          // Handle OSC 8 hyperlinks BEFORE ANSI conversion
          // Looking at the actual format: ]8;id=ID;URL\TEXT]8;;\
          const linkPlaceholders: { placeholder: string; html: string }[] = []
          let linkIndex = 0

          // Replace OSC 8 sequences with placeholders that won't be affected by ANSI conversion
          // Format: ]8;id=ID;URL\TEXT]8;;\
          cleanMessage = cleanMessage.replace(
            /\]8;[^;]*;([^\\]+)\\([^\]]+?)\]8;;\\?/g,
            (match, url, text) => {
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
        <div
          style={style}
          className="flex items-center px-4 hover:bg-gray-100 dark:hover:bg-gray-800 overflow-hidden"
        >
          <span className="text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0 font-mono text-xs">
            {formatTimestamp(log.timestamp)}
          </span>
          <span
            className={`flex-1 font-mono text-sm leading-tight whitespace-pre overflow-hidden ${
              log.type === 'stderr' ? 'text-red-600 dark:text-red-400' : ''
            }`}
            dangerouslySetInnerHTML={processedMessage}
          />
        </div>
      )
    }
  )
  LogRow.displayName = 'LogRow'

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto">
      {/* Compact Status Bar - Sticky */}
      <div className="flex-shrink-0 bg-card border-b border-border px-6 py-3 flex items-center justify-between gap-4 mt-6">
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

        {/* Right side: Control Buttons */}
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
          <div className="h-5 w-px bg-border mx-1" />
          <button
            onClick={clearLogs}
            className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear Logs
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

      {/* Logs Container - Scrollable */}
      <div className="flex-1 min-h-0 px-6 py-4 pb-6">
        <div
          ref={logsContainerRef}
          className="bg-gray-900 dark:bg-black rounded-lg h-full overflow-hidden relative"
        >
          {logs.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8">
              No logs available
            </div>
          ) : (
            <List
              listRef={listRef}
              rowComponent={LogRow}
              rowCount={logs.length}
              rowHeight={getItemSize}
              rowProps={{ logs }}
              onScroll={handleScroll}
              className="terminal-scrollbar"
              style={{
                backgroundColor: 'rgb(17 24 39)',
                color: '#e5e7eb'
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default Engine
