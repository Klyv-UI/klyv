'use client'

import { forwardRef, memo, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { CopyButton } from '../CopyButton'
import { AnsiOutputScreen, paletteRgb, runsOf, type AnsiOutputCell, type AnsiOutputStyle } from './ansi'

export interface AnsiOutputHandle {
  /** Feed more output; escape sequences split across calls are fine. */
  append: (chunk: string) => void
  /** Empty the screen. */
  clear: () => void
  /** The screen as plain text. */
  text: () => string
}

export interface AnsiOutputProps {
  /**
   * The whole output so far. When a new value extends the old one only the
   * new part is parsed; any other change starts over. Leave it out and use the
   * ref’s `append` for streaming instead.
   */
  value?: string
  /** Accessible name for the log. */
  label?: string
  /** Lines kept before the oldest scroll away. */
  maxLines?: number
  /** Keep the newest line in view while the reader is at the bottom. */
  follow?: boolean
  /** Wrap long lines instead of scrolling sideways. */
  wrap?: boolean
  /** Announce new output to screen readers. Off by default: a redrawn progress bar would be read on every frame. */
  announce?: boolean
  /** Show a copy-as-text button. */
  copyable?: boolean
  /** Override palette entries 0–15 with any CSS colour. */
  palette?: Partial<Record<number, string>>
  /** Merged last, so it wins. Set the height here. */
  className?: string
}

/** The 16 colours, from theme tokens, so output reads in light and dark themes alike. */
const PALETTE: string[] = [
  'color-mix(in oklab, var(--color-ink) 80%, var(--color-surface))',
  'var(--color-danger)',
  'var(--color-success)',
  'color-mix(in oklab, var(--color-warning) 70%, var(--color-ink))',
  'var(--syntax-type)',
  'var(--syntax-keyword)',
  'color-mix(in oklab, var(--syntax-type) 50%, var(--color-success))',
  'var(--color-ink-soft)',
  'var(--color-ink-faint)',
  'color-mix(in oklab, var(--color-danger) 75%, var(--color-warning))',
  'color-mix(in oklab, var(--color-success) 70%, var(--color-accent))',
  'var(--color-warning)',
  'color-mix(in oklab, var(--syntax-type) 70%, var(--syntax-fn))',
  'var(--syntax-fn)',
  'color-mix(in oklab, var(--syntax-type) 40%, var(--syntax-string))',
  'var(--color-ink)',
]

const colour = (c: number | string | undefined) => (c === undefined ? undefined : typeof c === 'number' ? (c < 16 ? `var(--ansi-${c})` : paletteRgb(c)) : c)

function css(style: AnsiOutputStyle): CSSProperties | undefined {
  if (Object.keys(style).length === 0) return undefined
  let color = colour(style.fg)
  let background = colour(style.bg)
  if (style.inverse) [color, background] = [background ?? 'var(--ansi-bg)', color ?? 'var(--ansi-fg)']
  const lines = [style.underline && 'underline', style.strike && 'line-through'].filter(Boolean).join(' ')
  return {
    color,
    backgroundColor: background,
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecorationLine: lines || undefined,
    opacity: style.dim ? 0.62 : undefined,
  }
}

const Line = memo(
  function Line({ cells }: { cells: AnsiOutputCell[]; version: number }) {
    if (cells.length === 0) return <div className="h-[1.5em]" />
    return (
      <div>
        {runsOf(cells).map((run, index) =>
          run.style.href ? (
            <a key={index} href={run.style.href} target="_blank" rel="noopener noreferrer" style={css(run.style)} className="underline decoration-dotted underline-offset-2 hover:decoration-solid">
              {run.text}
            </a>
          ) : (
            <span key={index} style={css(run.style)}>
              {run.text}
            </span>
          ),
        )}
      </div>
    )
  },
  (a, b) => a.cells === b.cells && a.version === b.version,
)

/**
 * Terminal output as the terminal would have drawn it — colours, bold,
 * links, and progress bars that redraw in place instead of printing a
 * thousand lines of 1%, 2%, 3%.
 *
 * Build logs and CLIs are written for a terminal, so dumping them into a
 * `<pre>` shows escape codes and every frame of every spinner. This keeps a
 * small screen model — cursor, carriage return, erase line, cursor up — and
 * renders the result, parsing each chunk as it streams in. The 16 base colours
 * are theme tokens exposed as `--ansi-0` to `--ansi-15`, so the output follows
 * light and dark themes; OSC 8 links become anchors only for http, https and
 * mailto targets.
 */
export const AnsiOutput = forwardRef<AnsiOutputHandle, AnsiOutputProps>(function AnsiOutput(
  { value, label = 'Output', maxLines = 2000, follow = true, wrap = false, announce = false, copyable = true, palette, className },
  ref,
) {
  const screen = useRef<AnsiOutputScreen | null>(null)
  const fed = useRef('')
  const [version, setVersion] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  if (!screen.current) screen.current = new AnsiOutputScreen(maxLines)

  // A value that extends what was fed is streamed; anything else is a fresh screen.
  if (value !== undefined && value !== fed.current) {
    if (!value.startsWith(fed.current)) {
      screen.current = new AnsiOutputScreen(maxLines)
      fed.current = ''
    }
    screen.current.write(value.slice(fed.current.length))
    fed.current = value
  }

  useImperativeHandle(
    ref,
    () => ({
      append: (chunk: string) => {
        screen.current!.write(chunk)
        setVersion((v) => v + 1)
      },
      clear: () => {
        screen.current = new AnsiOutputScreen(maxLines)
        fed.current = ''
        setVersion((v) => v + 1)
      },
      text: () => screen.current!.text(),
    }),
    [maxLines],
  )

  useIsomorphicLayoutEffect(() => {
    const node = scroller.current
    if (node && follow && stick.current) node.scrollTop = node.scrollHeight
  })

  const current = screen.current
  const vars: Record<string, string> = { '--ansi-fg': 'var(--color-ink)', '--ansi-bg': 'var(--color-surface-sunken)' }
  PALETTE.forEach((fallback, index) => (vars[`--ansi-${index}`] = palette?.[index] ?? fallback))

  return (
    <div className={cn('relative flex min-h-24 flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface-sunken', className)} data-version={version}>
      {copyable && (
        <div className="absolute right-2 top-2 z-[var(--z-raised)]">
          <CopyButton value={current.text()} label="Copy output" iconOnly size="sm" />
        </div>
      )}
      <div
        ref={scroller}
        role="log"
        aria-label={label}
        aria-live={announce ? 'polite' : 'off'}
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget
          stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 8
        }}
        style={vars as CSSProperties}
        className={cn(
          'min-h-0 flex-1 overflow-auto p-3 pr-12 font-mono text-[12px] leading-[1.5] text-ink',
          wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
        )}
      >
        {current.dropped > 0 && <div className="text-ink-faint">… {current.dropped.toLocaleString()} earlier lines not kept</div>}
        {current.lines.map((cells, index) => (
          <Line key={index} cells={cells} version={current.versions[index] ?? 0} />
        ))}
      </div>
    </div>
  )
})
