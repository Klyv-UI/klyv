'use client'

import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Surface } from '../Surface'
import { Tag } from '../Tag'
import { Text } from '../Text'
import { TOKEN_COLOR, tokenize } from './highlight'

export interface CodeBlockProps {
  /** The source. */
  code: string
  /** Language label shown in the header. */
  language?: string
  /** Show a copy-to-clipboard control. */
  copyable?: boolean
  /** Number the lines. */
  numbered?: boolean
  /** Colour TypeScript and TSX tokens. */
  highlight?: boolean
  /**
   * Clip to `collapsedLines` with a control to expand. The full source is
   * always in the DOM, so find-in-page and copy work while it is collapsed.
   */
  collapsible?: boolean
  /** Lines shown before the expand control appears. */
  collapsedLines?: number
  /** Start expanded. Only meaningful with `collapsible`. */
  defaultOpen?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Preformatted source on a sunken surface.
 *
 * Highlighting is done by a ~60-line lexer in this folder rather than by a
 * syntax library: every one of those ships a grammar engine and a palette of
 * its own, and both would be larger than the component using them. The colours
 * come from CSS variables, so a consumer restyles them without touching this.
 *
 * Collapsing clips the height rather than removing lines. That keeps the whole
 * file in the DOM, which is what lets Ctrl+F and Copy work on a collapsed block
 * — the usual implementation slices the string and quietly breaks both.
 */
export function CodeBlock({
  code,
  language,
  copyable = true,
  numbered = false,
  highlight = true,
  collapsible = false,
  collapsedLines = 14,
  defaultOpen = false,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(defaultOpen)

  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code])
  const rendered = useMemo(
    () => lines.map((line) => (highlight ? tokenize(line) : null)),
    [lines, highlight],
  )

  const clipped = collapsible && !open && lines.length > collapsedLines

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Surface variant="sunken" className={cn('overflow-hidden', className)}>
      {(language || copyable) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
          {language ? <Tag size="sm">{language}</Tag> : <span />}
          {copyable && (
            <button
              type="button"
              onClick={copy}
              className="rounded-full px-2 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {copied ? 'Copied' : 'Copy'}
              <span role="status" aria-live="polite" className="sr-only">
                {copied ? 'Copied to clipboard' : ''}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <pre
          // A scrolling region a mouse can reach but a keyboard cannot is a
          // trap: long lines scroll sideways, so the block takes focus itself.
          tabIndex={0}
          className={cn(
            'm-0 overflow-x-auto px-3 py-3',
            'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-strong',
            clipped && 'overflow-y-hidden',
          )}
          // An em-based cap so the clip lands on a line boundary at any size.
          style={clipped ? { maxHeight: `calc(${collapsedLines} * 1.625em + 1.5rem)` } : undefined}
        >
          <code className="font-mono text-[11px] leading-relaxed text-ink-soft">
            {lines.map((line, index) => (
              <span key={index} className={cn(numbered ? 'flex gap-3' : 'block')}>
                {numbered && (
                  <Text
                    as="span"
                    size="caption"
                    tone="faint"
                    tabular
                    aria-hidden
                    className="w-7 shrink-0 select-none text-right font-mono"
                  >
                    {index + 1}
                  </Text>
                )}
                <span className="whitespace-pre">
                  {rendered[index]
                    ? rendered[index]!.map((token, tokenIndex) => (
                        <span key={tokenIndex} style={{ color: TOKEN_COLOR[token.kind] }}>
                          {token.text}
                        </span>
                      ))
                    : line}
                  {/* Keeps blank lines from collapsing to zero height. */}
                  {line === '' && '​'}
                </span>
              </span>
            ))}
          </code>
        </pre>

        {clipped && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface-sunken to-transparent"
          />
        )}
      </div>

      {collapsible && lines.length > collapsedLines && (
        <div className="border-t border-line px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="rounded-full px-2 py-1 text-[11px] font-bold text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          >
            {open ? 'Collapse' : `Show all ${lines.length} lines`}
          </button>
        </div>
      )}
    </Surface>
  )
}
