'use client'

import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export type AgendaListTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger'

export interface AgendaListEvent {
  id: string
  title: string
  /** When it starts. For an all-day event only the date is read. */
  start: Date | string
  /** When it ends. */
  end?: Date | string
  /** Shown as "All day" instead of a time range. */
  allDay?: boolean
  /** Secondary line — a room, a call link, who is coming. */
  detail?: ReactNode
  /** Colour of the bar beside the event. */
  tone?: AgendaListTone
}

export interface AgendaListProps {
  events: AgendaListEvent[]
  /** The moment "Today" and the now marker are measured from. Defaults to the clock, re-read each minute. */
  now?: Date
  /** Called when an event is chosen. Without it, events are plain text. */
  onEventClick?: (event: AgendaListEvent) => void
  /** Keep each day's heading pinned while its events scroll under it. */
  stickyHeaders?: boolean
  /** Cap the height in pixels and scroll inside. */
  maxHeight?: number
  /** Shown when there are no events at all. */
  empty?: ReactNode
  /** Accessible name for the agenda. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const BARS: Record<AgendaListTone, string> = {
  accent: 'bg-accent-strong',
  neutral: 'bg-line-strong',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value))
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

function dayLabel(date: Date, now: Date) {
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diff = Math.round((startOf(date) - startOf(now)) / 86_400_000)
  const full = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const relative = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : null
  return { relative, full }
}

/**
 * The next few days as a list — what a calendar looks like on a phone, and in
 * a sidebar where a month grid would be all empty squares.
 *
 * Days without events are left out rather than shown as "Nothing scheduled",
 * so a quiet week is short instead of long. The nearest days are named ("Today",
 * "Tomorrow") because that is how people ask, with the date still beside them.
 *
 * Today carries a now line between the event that has started and the one
 * that has not, and the event in progress is marked. The clock re-reads once
 * a minute, which is as often as either can move.
 */
export function AgendaList({
  events,
  now: nowProp,
  onEventClick,
  stickyHeaders = true,
  maxHeight,
  empty = 'Nothing scheduled.',
  label = 'Agenda',
  className,
}: AgendaListProps) {
  const [clock, setClock] = useState(() => new Date())
  const now = nowProp ?? clock
  const baseId = useId()

  useEffect(() => {
    if (nowProp) return
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [nowProp])

  const days = useMemo(() => {
    const sorted = events
      .map((event) => ({ event, start: toDate(event.start), end: event.end ? toDate(event.end) : undefined }))
      .sort((a, b) => {
        if (dayKey(a.start) === dayKey(b.start) && a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1
        return a.start.getTime() - b.start.getTime()
      })
    const groups: { key: string; date: Date; items: typeof sorted }[] = []
    for (const item of sorted) {
      const key = dayKey(item.start)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(item)
      else groups.push({ key, date: item.start, items: [item] })
    }
    return groups
  }, [events])

  const todayKey = dayKey(now)

  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={maxHeight ? 0 : undefined}
      style={maxHeight ? { maxHeight } : undefined}
      className={cn(
        'flex w-full flex-col',
        maxHeight && 'overflow-y-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
        className,
      )}
    >
      {days.length === 0 && (
        <Text size="label" tone="faint" className="px-1 py-6 text-center">
          {empty}
        </Text>
      )}
      {days.map((day) => {
        const { relative, full } = dayLabel(day.date, now)
        const headingId = `${baseId}-${day.key}`
        const isToday = day.key === todayKey
        // The now line goes before the first timed event that has not started.
        const nowIndex = isToday
          ? (() => {
              const index = day.items.findIndex((item) => !item.event.allDay && item.start > now)
              return index === -1 ? day.items.length : index
            })()
          : -1

        return (
          <div key={day.key} className="flex flex-col">
            <div
              id={headingId}
              className={cn(
                'z-[var(--z-raised)] flex items-baseline gap-2 border-b border-line bg-surface px-1 pb-1.5 pt-3',
                stickyHeaders && 'sticky top-0',
              )}
            >
              <span className="text-[13px] font-bold text-ink">{relative ?? full}</span>
              {relative && <span className="text-[12px] font-medium text-ink-faint">{full}</span>}
            </div>
            <ul aria-labelledby={headingId} className="flex flex-col py-1">
              {day.items.map((item, index) => {
                const { event, start, end } = item
                const happening = !event.allDay && start <= now && (end ? end > now : false)
                const past = !event.allDay && (end ?? start) <= now
                const range = event.allDay ? 'All day' : end ? `${time(start)} – ${time(end)}` : time(start)
                const body = (
                  <>
                    <span aria-hidden="true" className={cn('w-1 self-stretch rounded-full', BARS[event.tone ?? 'accent'])} />
                    <span className="w-[92px] shrink-0 pt-px text-[12px] font-semibold tabular-nums text-ink-soft">{range}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cn('text-[13px] font-bold', past ? 'text-ink-soft' : 'text-ink')}>
                        {event.title}
                        {happening && (
                          <span className="ml-2 inline-flex rounded-full bg-accent px-1.5 py-px align-middle text-[10px] font-bold text-accent-ink">
                            Now
                          </span>
                        )}
                      </span>
                      {event.detail && <span className="text-[12px] font-medium text-ink-faint">{event.detail}</span>}
                    </span>
                  </>
                )
                const row = 'flex w-full items-start gap-3 rounded-[var(--radius-10)] px-1 py-2 text-left'
                return (
                  <Fragment key={event.id}>
                    {index === nowIndex && <NowLine now={now} />}
                    <li>
                      {onEventClick ? (
                        <button type="button" onClick={() => onEventClick(event)} className={cn(row, 'transition-colors hover:bg-surface-muted')}>
                          {body}
                        </button>
                      ) : (
                        <div className={row}>{body}</div>
                      )}
                    </li>
                  </Fragment>
                )
              })}
              {nowIndex === day.items.length && <NowLine now={now} />}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function NowLine({ now }: { now: Date }) {
  return (
    <li className="flex items-center gap-2 px-1 py-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-danger">
        <VisuallyHidden>Current time, </VisuallyHidden>
        {time(now)}
      </span>
      <span aria-hidden="true" className="relative h-px flex-1 bg-danger before:absolute before:-left-0.5 before:-top-[3px] before:size-[7px] before:rounded-full before:bg-danger" />
    </li>
  )
}
