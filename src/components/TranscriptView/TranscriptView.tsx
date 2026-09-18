'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { SearchField } from '../SearchField'
import { ChevronDownIcon, ChevronUpIcon } from '../internal/icons'

export interface TranscriptViewLine {
  id: string
  /** When the line starts, in seconds from the beginning of the recording. */
  start: number
  /** When it ends. Defaults to the next line’s start. */
  end?: number
  /** Who is talking. Printed when it changes from the line before. */
  speaker?: string
  text: string
}

export interface TranscriptViewProps {
  /** The transcript, in time order. */
  lines: TranscriptViewLine[]
  /** Accessible name for the transcript list. */
  label: string
  /** Playback position in seconds. The line it falls in is highlighted and followed. */
  currentTime?: number
  /** Called when a line is clicked or activated with Enter, with that line’s start time. */
  onSeek?: (time: number, line: TranscriptViewLine) => void
  /** Show the search field above the transcript. */
  searchable?: boolean
  /** Keep the current line in view as playback moves. Pauses while the reader scrolls. */
  autoScroll?: boolean
  /** Height of the scrolling list in pixels. */
  height?: number
  /** Format a start time. Defaults to m:ss, or h:mm:ss past the hour. */
  formatTime?: (seconds: number) => string
  /** Merged last, so it wins. */
  className?: string
}

function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.split(new RegExp(`(${escaped})`, 'gi')).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded-[3px] bg-accent px-0.5 text-accent-ink">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}

/**
 * A recording’s transcript that follows playback: the line being spoken is
 * highlighted and kept in view, and clicking any line seeks to it.
 *
 * Following stops the moment the reader takes over. A wheel, a touch drag or
 * arrowing through lines pauses it, and a “Back to current line” button brings
 * it back — a transcript that yanks you to the playhead while you are reading
 * ahead is one people stop using. Programmatic scrolls never count as the
 * reader’s, because they are recognised by the input that causes them, not by
 * the scroll event, which fires for both.
 *
 * Lines are one tab stop with arrow keys between them, so a two-hour meeting is
 * not two thousand presses to get past. Search highlights matches in place
 * rather than filtering, since the lines around a match are usually why you
 * searched; Enter and Shift+Enter step through them.
 */
export function TranscriptView({
  lines,
  label,
  currentTime,
  onSeek,
  searchable = true,
  autoScroll = true,
  height = 360,
  formatTime = clock,
  className,
}: TranscriptViewProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const reducedMotion = usePrefersReducedMotion()
  const [focusIndex, setFocusIndex] = useState(0)
  const [following, setFollowing] = useState(true)
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  // The first Enter goes to the first match; only later presses step past it.
  const [stepped, setStepped] = useState(false)

  const current =
    currentTime === undefined
      ? -1
      : lines.findIndex((line, index) => {
          const end = line.end ?? lines[index + 1]?.start ?? Number.POSITIVE_INFINITY
          return currentTime >= line.start && currentTime < end
        })

  const trimmed = query.trim()
  const matches = useMemo(
    () =>
      trimmed
        ? lines.flatMap((line, index) => (line.text.toLowerCase().includes(trimmed.toLowerCase()) ? [index] : []))
        : [],
    [lines, trimmed],
  )
  const activeMatch = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : -1
  const tabStop = Math.min(focusIndex, Math.max(0, lines.length - 1))

  const scrollTo = (index: number, smooth: boolean) => {
    const list = listRef.current
    const item = itemRefs.current[index]
    if (!list || !item || typeof list.scrollTo !== 'function') return
    const top = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2
    list.scrollTo({ top: Math.max(0, top), behavior: smooth && !reducedMotion ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    if (autoScroll && following && current >= 0) scrollTo(current, true)
    // Only the line changing should move the list, not every tick of currentTime.
  }, [current, following, autoScroll]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToMatch = (next: number) => {
    if (!matches.length) return
    const wrapped = (next + matches.length) % matches.length
    setMatchIndex(wrapped)
    setStepped(true)
    setFollowing(false)
    setFocusIndex(matches[wrapped])
    scrollTo(matches[wrapped], true)
  }

  const onListKeyDown = (event: KeyboardEvent, index: number) => {
    const targets: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: lines.length - 1,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = Math.min(lines.length - 1, Math.max(0, target))
    setFollowing(false)
    setFocusIndex(next)
    itemRefs.current[next]?.focus()
  }

  const paused = autoScroll && !following && current >= 0

  return (
    <div className={cn('flex w-full flex-col gap-2.5', className)}>
      {searchable && (
        <div className="flex items-center gap-1.5">
          <SearchField
            value={query}
            onValueChange={(value) => {
              setQuery(value)
              setMatchIndex(0)
              setStepped(false)
            }}
            label="Search transcript"
            placeholder="Search transcript"
            inputSize="sm"
            containerClassName="min-w-0 flex-1"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              goToMatch(event.shiftKey ? matchIndex - 1 : stepped ? matchIndex + 1 : matchIndex)
            }}
          />
          <span
            role="status"
            className="min-w-[64px] text-center text-[11px] font-semibold tabular-nums text-ink-faint"
          >
            {trimmed ? (matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} of ${matches.length}` : 'No matches') : ''}
          </span>
          <IconButton
            icon={ChevronUpIcon}
            label="Previous match"
            size="xs"
            tone="bare"
            disabled={!matches.length}
            onClick={() => goToMatch(matchIndex - 1)}
          />
          <IconButton
            icon={ChevronDownIcon}
            label="Next match"
            size="xs"
            tone="bare"
            disabled={!matches.length}
            onClick={() => goToMatch(matchIndex + 1)}
          />
        </div>
      )}

      <div className="relative">
        <ol
          ref={listRef}
          aria-label={label}
          className={cn(
            'relative flex list-none flex-col gap-0.5 overflow-y-auto overscroll-contain',
            'rounded-[var(--radius-card)] border border-line bg-surface p-1.5',
          )}
          style={{ maxHeight: height }}
          onWheel={() => setFollowing(false)}
          onTouchMove={() => setFollowing(false)}
        >
          {lines.map((line, index) => {
            const isCurrent = index === current
            const showSpeaker = line.speaker && line.speaker !== lines[index - 1]?.speaker
            return (
              <li key={line.id} className={cn(showSpeaker && index > 0 && 'mt-2')}>
                <button
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  type="button"
                  tabIndex={index === tabStop ? 0 : -1}
                  aria-current={isCurrent ? 'true' : undefined}
                  onFocus={() => setFocusIndex(index)}
                  onKeyDown={(event) => onListKeyDown(event, index)}
                  onClick={() => {
                    setFocusIndex(index)
                    setFollowing(true)
                    onSeek?.(line.start, line)
                  }}
                  className={cn(
                    'grid w-full grid-cols-[52px_1fr] gap-x-2 rounded-[10px] px-2 py-1.5 text-left transition-colors',
                    isCurrent
                      ? 'bg-[color-mix(in_oklab,var(--color-accent)_28%,transparent)]'
                      : 'hover:bg-surface-sunken',
                    index === activeMatch && 'ring-1 ring-inset ring-ink-faint',
                  )}
                >
                  <span className={cn('pt-px text-[11px] font-semibold tabular-nums', isCurrent ? 'text-ink' : 'text-ink-faint')}>
                    {formatTime(line.start)}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    {showSpeaker && <span className="text-[11px] font-bold text-ink-soft">{line.speaker}</span>}
                    {!showSpeaker && line.speaker && <span className="sr-only">{line.speaker}: </span>}
                    <span
                      className={cn(
                        'text-[13px] leading-normal',
                        isCurrent ? 'font-semibold text-ink' : 'font-medium text-ink-soft',
                      )}
                    >
                      {highlight(line.text, trimmed)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {paused && (
          <Button
            size="sm"
            variant="white"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-[var(--shadow-float)]"
            onClick={() => {
              setFollowing(true)
              scrollTo(current, true)
            }}
          >
            Back to current line
          </Button>
        )}
      </div>
    </div>
  )
}
