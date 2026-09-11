'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface ScheduleEvent {
  id: string
  title: string
  /** 24-hour "HH:MM". */
  start: string
  end: string
  detail?: string
  color?: string
  /** Drawn as an outline — a hold, a tentative invitation. */
  tentative?: boolean
}

export interface DayScheduleProps {
  events: ScheduleEvent[]
  /** Accessible name — whose day, or which day. */
  label: string
  /** First and last hour drawn, 0 to 24. */
  from?: number
  /** Last hour drawn, as a 24-hour number. */
  to?: number
  /** Pixels per hour. */
  hourHeight?: number
  /** Show a line at the current time when it falls inside the range. */
  showNow?: boolean
  onSelect?: (event: ScheduleEvent) => void
  /** Merged last, so it wins. */
  className?: string
}

interface Placed extends ScheduleEvent {
  top: number
  height: number
  column: number
  columns: number
}

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

/**
 * A day as a column of hours, with events placed on it and overlaps resolved.
 *
 * Overlapping events are the whole problem. They are grouped into clusters —
 * runs of events that touch, directly or through a third — and each cluster is
 * divided into as many columns as its busiest moment needs. Splitting the width
 * by the number of events in the *cluster* instead makes three events that
 * merely share a morning each a third as wide, when none of them overlaps at
 * all.
 *
 * Columns are assigned greedily, first-fit: an event takes the leftmost column
 * whose last event has already ended. That is what keeps a long meeting on the
 * left with short ones stacking beside it, rather than a staircase.
 *
 * Everything is positioned from minutes, so a 25-minute event is 25 minutes
 * tall and a schedule never lies about proportions. The current-time line
 * updates on a minute timer rather than a frame loop.
 */
export function DaySchedule({
  events,
  label,
  from = 8,
  to = 20,
  hourHeight = 52,
  showNow = true,
  onSelect,
  className,
}: DayScheduleProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!showNow) return
    // A minute is the resolution the line has; anything faster is waste.
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [showNow])

  const dayStart = from * 60
  const dayEnd = to * 60
  const height = ((dayEnd - dayStart) / 60) * hourHeight

  const placed = useMemo<Placed[]>(() => {
    const sorted = [...events]
      .map((event) => ({ event, start: minutesOf(event.start), end: minutesOf(event.end) }))
      .sort((a, b) => a.start - b.start || b.end - a.end)

    const result: Placed[] = []
    let cluster: typeof sorted = []
    let clusterEnd = -1

    const flush = () => {
      if (cluster.length === 0) return
      // First fit: the leftmost column whose last event has ended.
      const columnEnds: number[] = []
      const assigned = cluster.map((entry) => {
        let column = columnEnds.findIndex((end) => end <= entry.start)
        if (column === -1) {
          column = columnEnds.length
          columnEnds.push(entry.end)
        } else {
          columnEnds[column] = entry.end
        }
        return { entry, column }
      })

      for (const { entry, column } of assigned) {
        result.push({
          ...entry.event,
          top: ((entry.start - dayStart) / 60) * hourHeight,
          height: Math.max(18, ((entry.end - entry.start) / 60) * hourHeight),
          column,
          columns: columnEnds.length,
        })
      }
      cluster = []
      clusterEnd = -1
    }

    for (const entry of sorted) {
      // A cluster continues while anything in it is still running.
      if (cluster.length > 0 && entry.start >= clusterEnd) flush()
      cluster.push(entry)
      clusterEnd = Math.max(clusterEnd, entry.end)
    }
    flush()

    return result
  }, [dayStart, events, hourHeight])

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowVisible = showNow && nowMinutes >= dayStart && nowMinutes <= dayEnd

  return (
    <div className={cn('flex gap-3', className)}>
      <div className="relative shrink-0" style={{ height, width: 44 }} aria-hidden="true">
        {Array.from({ length: to - from + 1 }, (_, index) => (
          <Text
            key={index}
            as="span"
            size="micro"
            tone="faint"
            tabular
            className="absolute right-0 -translate-y-1/2"
            style={{ top: index * hourHeight }}
          >
            {String(from + index).padStart(2, '0')}:00
          </Text>
        ))}
      </div>

      <div
        className="relative min-w-0 flex-1 rounded-[var(--radius-glyph)] border border-line bg-surface"
        style={{ height }}
        role="group"
        aria-label={label}
      >
        {Array.from({ length: to - from }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-line"
            style={{ top: (index + 1) * hourHeight }}
          />
        ))}

        {placed.map((event) => {
          const Component = onSelect ? 'button' : 'div'
          const gap = 3
          const columnWidth = 100 / event.columns
          return (
            <Component
              key={event.id}
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(event) } : {})}
              className={cn(
                'absolute overflow-hidden rounded-[8px] px-2 py-1 text-left transition-shadow',
                event.tentative
                  ? 'border border-dashed border-line-strong bg-surface'
                  : 'border border-transparent',
                onSelect && 'hover:shadow-[var(--shadow-float)]',
              )}
              style={{
                top: event.top,
                height: event.height,
                left: `calc(${event.column * columnWidth}% + ${gap}px)`,
                width: `calc(${columnWidth}% - ${gap * 2}px)`,
                background: event.tentative ? undefined : (event.color ?? 'var(--color-accent-soft)'),
              }}
            >
              <Text as="span" size="micro" weight="bold" truncate className="block text-ink">
                {event.title}
              </Text>
              {event.height > 34 && (
                <Text as="span" size="micro" tone="soft" truncate className="block">
                  {event.start}–{event.end}
                  {event.detail ? ` · ${event.detail}` : ''}
                </Text>
              )}
            </Component>
          )
        })}

        {nowVisible && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: ((nowMinutes - dayStart) / 60) * hourHeight }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
            <span className="h-px flex-1 bg-danger" />
          </div>
        )}
      </div>

      <VisuallyHidden>
        <ul>
          {[...events]
            .sort((a, b) => minutesOf(a.start) - minutesOf(b.start))
            .map((event) => (
              <li key={event.id}>
                {event.start} to {event.end}: {event.title}
                {event.tentative ? ' (tentative)' : ''}
                {event.detail ? `, ${event.detail}` : ''}
              </li>
            ))}
        </ul>
      </VisuallyHidden>
    </div>
  )
}
