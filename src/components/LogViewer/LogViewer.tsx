'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { Input } from '../Input'
import { Switch } from '../Switch'
import { CopyIcon, SearchIcon } from '../internal/icons'

export type LogViewerLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogViewerLine {
  /** Stable key. Defaults to the position. */
  id?: string | number
  timestamp: Date | number | string
  level: LogViewerLevel
  message: string
  /** Service or logger name, shown before the message and searched. */
  source?: string
}

export interface LogViewerProps {
  /** Every line, oldest first. Append to stream. */
  lines: LogViewerLine[]
  /** Names the log region. */
  label?: string
  /** Height of the scrolling log, in pixels. */
  height?: number
  /** Levels shown at first. */
  defaultLevels?: LogViewerLevel[]
  /** Start pinned to the newest line. */
  defaultFollow?: boolean
  /** Start with long lines wrapped. */
  defaultWrap?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const LEVELS: LogViewerLevel[] = ['debug', 'info', 'warn', 'error']
const CHIP: Record<LogViewerLevel, string> = {
  debug: 'bg-surface-muted text-ink-soft',
  info: 'bg-accent-soft text-ink',
  warn: 'bg-[color-mix(in_oklab,var(--color-warning)_26%,transparent)] text-ink',
  error: 'bg-[color-mix(in_oklab,var(--color-danger)_18%,transparent)] text-danger',
}
const ROW = 22
const OVERSCAN = 12
/** Wrapped lines have no fixed height to window by, so wrapping shows the newest this many. */
const WRAP_LIMIT = 1000

const pad = (value: number, size = 2) => String(value).padStart(size, '0')
const clock = (stamp: LogViewerLine['timestamp']) => {
  const date = stamp instanceof Date ? stamp : new Date(stamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

function highlight(text: string, needle: string): ReactNode {
  if (!needle) return text
  const lower = text.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    parts.push(text.slice(from, at), <mark key={at} className="rounded-[var(--radius-3)] bg-accent text-accent-ink">{text.slice(at, at + needle.length)}</mark>)
    from = at + needle.length
  }
  parts.push(text.slice(from))
  return parts
}

/**
 * A log tail: timestamps, level chips, search, and a follow mode that knows
 * when to stop.
 *
 * Following is the default and the trap. A viewer that keeps jumping to the
 * newest line makes it impossible to read the error that just scrolled past,
 * so scrolling up pauses following, the footer counts the lines that arrived
 * since, and one button jumps back. Nothing re-pins itself behind the reader.
 *
 * Unwrapped lines are one fixed height, so only the rows in view are rendered
 * and five thousand lines cost what forty do. Wrapping gives up the fixed
 * height, so it shows the newest thousand matching lines and says so, rather
 * than pretending to window rows it cannot measure. Search filters to matching
 * lines and marks each match; level toggles show their counts.
 */
export function LogViewer({
  lines,
  label = 'Logs',
  height = 360,
  defaultLevels = LEVELS,
  defaultFollow = true,
  defaultWrap = false,
  className,
}: LogViewerProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [levels, setLevels] = useState(() => new Set(defaultLevels))
  const [query, setQuery] = useState('')
  const [follow, setFollow] = useState(defaultFollow)
  const [wrap, setWrap] = useState(defaultWrap)
  const [scrollTop, setScrollTop] = useState(0)
  const [pausedAt, setPausedAt] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const needle = query.trim().toLowerCase()

  const counts = useMemo(() => {
    const tally: Record<LogViewerLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 }
    lines.forEach((line) => tally[line.level]++)
    return tally
  }, [lines])

  const shown = useMemo(
    () =>
      lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => levels.has(line.level) && (!needle || `${line.source ?? ''} ${line.message}`.toLowerCase().includes(needle))),
    [lines, levels, needle],
  )
  const rows = wrap ? shown.slice(-WRAP_LIMIT) : shown

  useIsomorphicLayoutEffect(() => {
    const node = scroller.current
    if (!follow || !node) return
    node.scrollTop = node.scrollHeight
    setScrollTop(node.scrollTop)
  }, [follow, shown.length, wrap])

  const onScroll = () => {
    const node = scroller.current
    if (!node) return
    setScrollTop(node.scrollTop)
    const fromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    if (follow && fromBottom > ROW * 2) {
      setFollow(false)
      setPausedAt(shown.length)
    }
  }

  const setFollowing = (on: boolean) => {
    setFollow(on)
    if (!on) setPausedAt(shown.length)
  }

  const copy = async (line: LogViewerLine, number: number) => {
    const text = `${clock(line.timestamp)} ${line.level.toUpperCase()} ${line.source ? `[${line.source}] ` : ''}${line.message}`
    try {
      await navigator.clipboard.writeText(text)
      setAnnouncement(`Copied line ${number}`)
    } catch {
      setAnnouncement('Copy failed')
    }
  }

  const first = wrap ? 0 : Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN)
  const last = wrap ? rows.length : Math.min(rows.length, Math.ceil((scrollTop + height) / ROW) + OVERSCAN)
  const fresh = follow ? 0 : shown.length - pausedAt

  return (
    <div className={cn('flex w-full flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface', className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2.5">
        <Input
          type="search"
          inputSize="sm"
          aria-label={`Search ${label}`}
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={<SearchIcon size={14} />}
          containerClassName="min-w-[160px] flex-1"
        />
        <div role="group" aria-label="Levels" className="flex flex-wrap gap-1">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levels.has(level)}
              onClick={() =>
                setLevels((current) => {
                  const next = new Set(current)
                  if (next.has(level)) next.delete(level)
                  else next.add(level)
                  return next
                })
              }
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-bold capitalize transition-colors',
                levels.has(level) ? 'border-line-strong bg-surface-muted text-ink' : 'border-line text-ink-faint line-through hover:text-ink',
              )}
            >
              {level}
              <span className="font-medium text-ink-faint tabular-nums">{counts[level].toLocaleString()}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 px-1 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={wrap} onChange={(event) => setWrap(event.target.checked)} />
          Wrap
        </label>
        <label className="flex items-center gap-2 px-1 text-[12px] font-semibold text-ink-soft">
          <Switch switchSize="sm" checked={follow} onChange={(event) => setFollowing(event.target.checked)} />
          Follow
        </label>
      </div>

      <div
        ref={scroller}
        role="region"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        className="relative overflow-auto bg-surface-sunken font-mono text-[12px] focus-visible:outline-offset-[-2px]"
        style={{ height }}
      >
        <div role="list" aria-label={`${label}, ${shown.length.toLocaleString()} lines`} className={cn('relative', wrap ? 'py-1' : 'min-w-full w-max')} style={wrap ? undefined : { height: rows.length * ROW }}>
          {rows.slice(first, last).map(({ line, index }, offset) => {
            const position = first + offset
            return (
              <div
                key={line.id ?? index}
                role="listitem"
                aria-setsize={rows.length}
                aria-posinset={position + 1}
                className={cn(
                  'group flex items-start gap-2.5 px-3 leading-[22px] hover:bg-surface-muted',
                  wrap ? 'whitespace-pre-wrap break-all' : 'absolute left-0 min-w-full whitespace-pre',
                  line.level === 'error' && 'bg-[color-mix(in_oklab,var(--color-danger)_6%,transparent)]',
                )}
                style={wrap ? { contentVisibility: 'auto', containIntrinsicSize: `auto ${ROW}px` } : { top: position * ROW, height: ROW }}
              >
                <span className="shrink-0 select-none text-right text-ink-faint tabular-nums" style={{ minWidth: `${String(lines.length).length}ch` }}>
                  {index + 1}
                </span>
                <span className="shrink-0 text-ink-faint tabular-nums">{clock(line.timestamp)}</span>
                <span className={cn('mt-[3px] w-11 shrink-0 rounded-[var(--radius-4)] text-center text-[10px] font-bold uppercase leading-4', CHIP[line.level])}>{line.level}</span>
                <span className="min-w-0 text-ink">
                  {line.source && <span className="text-ink-soft">[{highlight(line.source, needle)}] </span>}
                  {highlight(line.message, needle)}
                </span>
                <button
                  type="button"
                  aria-label={`Copy line ${index + 1}`}
                  onClick={() => copy(line, index + 1)}
                  className="sticky right-1 ml-auto mt-[1px] flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-5)] bg-surface text-ink-soft opacity-0 shadow-[var(--shadow-tile)] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <CopyIcon size={12} />
                </button>
              </div>
            )
          })}
        </div>
        {shown.length === 0 && (
          <p className="absolute inset-x-0 top-10 text-center font-sans text-[12px] font-medium text-ink-faint">
            {lines.length === 0 ? 'Waiting for logs' : 'No lines match'}
          </p>
        )}
      </div>

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-1.5 text-[11px] font-medium text-ink-faint tabular-nums">
        <span>
          {needle || levels.size < LEVELS.length
            ? `${shown.length.toLocaleString()} of ${lines.length.toLocaleString()} lines`
            : `${lines.length.toLocaleString()} lines`}
          {wrap && shown.length > WRAP_LIMIT && ` · wrapping shows the newest ${WRAP_LIMIT.toLocaleString()}`}
        </span>
        {!follow && (
          <button type="button" onClick={() => setFollowing(true)} className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-ink hover:bg-accent-strong">
            {fresh > 0 ? `${fresh.toLocaleString()} new · ` : ''}Jump to latest
          </button>
        )}
        <span role="status" className="sr-only">
          {announcement}
        </span>
      </div>
    </div>
  )
}
