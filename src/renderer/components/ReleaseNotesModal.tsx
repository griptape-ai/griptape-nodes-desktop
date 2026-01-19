import React from 'react'
import { Sparkles, ExternalLink, X } from 'lucide-react'
import type { ReleaseNotesInfo } from '@/types/global'

interface ReleaseNotesModalProps {
  releaseNotes: ReleaseNotesInfo
  onDismiss: () => void
  onOpenExternal: (url: string) => void
}

/**
 * Simple markdown-like renderer for release notes content.
 * Handles headers, bold, lists, and links.
 */
function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []

  const processInlineFormatting = (text: string): React.ReactNode => {
    // Handle links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(processBold(text.slice(lastIndex, match.index)))
      }
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          onClick={(e) => {
            e.preventDefault()
            window.electronAPI.openExternal(match[2])
          }}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {match[1]}
        </a>
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(processBold(text.slice(lastIndex)))
    }

    return parts.length > 0 ? parts : processBold(text)
  }

  const processBold = (text: string): React.ReactNode => {
    // Handle bold: **text** or __text__
    const boldRegex = /\*\*([^*]+)\*\*|__([^_]+)__/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      parts.push(
        <strong key={match.index} className="font-semibold">
          {match[1] || match[2]}
        </strong>
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-3">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()

    // Skip empty lines
    if (!trimmedLine) {
      flushList()
      return
    }

    // Headers
    if (trimmedLine.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={index} className="text-xl font-bold mb-3 text-foreground">
          {processInlineFormatting(trimmedLine.slice(2))}
        </h1>
      )
      return
    }

    if (trimmedLine.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={index} className="text-lg font-semibold mb-2 mt-4 text-foreground">
          {processInlineFormatting(trimmedLine.slice(3))}
        </h2>
      )
      return
    }

    if (trimmedLine.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={index} className="text-base font-semibold mb-2 mt-3 text-foreground">
          {processInlineFormatting(trimmedLine.slice(4))}
        </h3>
      )
      return
    }

    // List items
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      listItems.push(
        <li key={index} className="text-muted-foreground">
          {processInlineFormatting(trimmedLine.slice(2))}
        </li>
      )
      return
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={index} className="text-muted-foreground mb-2">
        {processInlineFormatting(trimmedLine)}
      </p>
    )
  })

  flushList()
  return elements
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  releaseNotes,
  onDismiss,
  onOpenExternal
}) => {
  const releaseUrl = `https://github.com/griptape-ai/griptape-nodes-desktop/releases/tag/v${releaseNotes.version}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                What&apos;s New in v{releaseNotes.version}
              </h2>
              <p className="text-sm text-muted-foreground">
                Check out the latest updates and improvements
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{renderMarkdown(releaseNotes.content)}</div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <button
            onClick={() => onOpenExternal(releaseUrl)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View on GitHub
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}
