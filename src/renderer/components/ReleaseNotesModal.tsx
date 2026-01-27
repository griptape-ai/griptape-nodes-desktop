import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Sparkles, X } from 'lucide-react'
import type { ReleaseNotesInfo } from '@/types/global'

interface ReleaseNotesModalProps {
  releaseNotes: ReleaseNotesInfo
  onDismiss: (dontShowAgain: boolean) => void
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  releaseNotes,
  onDismiss
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
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
            onClick={() => onDismiss(dontShowAgain)}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => {
                return (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault()
                      if (href) window.electronAPI.openExternal(href)
                    }}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    {children}
                  </a>
                )
              },
              // Styled headers
              h1: ({ children }) => (
                <h1 className="text-xl font-bold mb-3 text-foreground">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold mb-2 mt-4 text-foreground">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold mb-2 mt-3 text-foreground">{children}</h3>
              ),
              // Styled lists
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 mb-3">{children}</ul>
              ),
              li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
              // Styled paragraphs
              p: ({ children }) => <p className="text-muted-foreground mb-2">{children}</p>,
              // Styled bold
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>
            }}
          >
            {releaseNotes.content}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-border">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background"
              />
              Don&apos;t show again
            </label>
            <button
              onClick={() => onDismiss(dontShowAgain)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
