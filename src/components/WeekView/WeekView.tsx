'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

export interface WeekViewEvent {
  id: string
  title: string
  start: Date
  end: Date
  /** Drawn in the all-day row instead of the grid. */
  allDay?: boolean
  /** Background, as any CSS colour or var(). Defaults to the soft accent. */
  color?: string
  /** Second line, such as a room. */
  detail?: string
}

export interface WeekViewProps {
  events: WeekViewEvent[]
  /** Any day in the week shown, controlled. */
  date?: Date
  /** Any day in the starting week, when uncontrolled. Defaults to today. */
  defaultDate?: Date
  /** Called with the first day of the new week after previous, next or today. */
  onDateChange?: (date: Date) => void
  /** 0 for Sunday, 1 for Monday. */
  weekStartsOn?: 0 | 1
  /** First hour drawn, 0 to 23. */
  startHour?: number
  /** Last hour drawn, 1 to 24. */
  endHour?: number
  /** Hour scrolled into view on mount. */
  scrollToHour?: number
  /** Pixels per hour. */
  hourHeight?: number
  /** Height of the scrolling grid, in pixels. */
  height?: number
  /** Minutes an empty-slot click snaps to, and the length of the slot it reports. */
  slotMinutes?: 15 | 30 | 60
  /** Called when an event is activated. */
  onEventSelect?: (event: WeekViewEvent) => void
  /** Called with the slot under an empty-grid click — the place to open a “New event” form. */
  onSlotCreate?: (start: Date, end: Date) => void
  /** The current moment, for the now line. Defaults to the clock, updated each minute. */
  now?: Date
  /** BCP 47 locale for day and time labels. */
  locale?: string
  /** Names the calendar region. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const DAY_MS = 86_400_000
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()
const weekOf = (date: Date, weekStartsOn: number) => addDays(startOfDay(date), -((date.getDay() - weekStartsOn + 7) % 7))

interface Placed {
  event: WeekViewEvent
  top: number
  height: number
  column: number
  columns: number
}

/** First-fit columns inside clusters of events that overlap, directly or through a third. */
function layoutDay(events: WeekViewEvent[], day: Date, startHour: number, endHour: number, hourHeight: number): Placed[] {
  const open = day.getTime() + startHour * 3_600_000
  const close = day.getTime() + endHour * 3_600_000
  const spans = events
    .filter((event) => !event.allDay && event.start.getTime() < close && event.end.getTime() > open)
    .map((event) => ({ event, from: Math.max(event.start.getTime(), open), to: Math.min(event.end.getTime(), close) }))
    .sort((a, b) => a.from - b.from || b.to - a.to)
  const placed: Placed[] = []
  let cluster: (typeof spans[number] & { column: number })[] = []
  let ends: number[] = []
  const flush = () => {
    cluster.forEach(({ event, from, to, column }) =>
      placed.push({ event, column, columns: ends.length, top: ((from - open) / 3_600_000) * hourHeight, height: Math.max(20, ((to - from) / 3_600_000) * hourHeight) }),
    )
    cluster = []
    ends = []
  }
  for (const span of spans) {
    if (cluster.length && span.from >= Math.max(...ends)) flush()
    let column = ends.findIndex((end) => end <= span.from)
    if (column === -1) column = ends.push(span.to) - 1
    else ends[column] = span.to
    cluster.push({ ...span, column })
  }
  flush()
  return placed
}

/**
 * Seven days side by side on an hour grid, for seeing how a week fills up.
 *
 * Overlaps are laid out the way DaySchedule does it — clusters split into only
 * as many columns as their busiest moment needs — and events that run past
 * midnight are clipped into each day they touch. All-day events get their own
 * row above the grid, so a holiday never pushes the 9:00 meeting out of place.
 *
 * Events are buttons in one tab stop: arrow keys walk them in time order and
 * each is named with its day and times, since position is the only thing a
 * sighted reader uses to know when something is. Clicking an empty part of a
 * day reports the slot under the pointer, snapped to `slotMinutes`; the grid
 * itself stays out of the tab order, as creating by keyboard belongs to the
 * page’s own “New event” button.
 */
export function WeekView({
  events,
  date,
  defaultDate,
  onDateChange,
  weekStartsOn = 1,
  startHour = 0,
  endHour = 24,
  scrollToHour = 8,
  hourHeight = 44,
  height = 440,
  slotMinutes = 30,
  onEventSelect,
  onSlotCreate,
  now: fixedNow,
  locale,
  label = 'Week',
  className,
}: WeekViewProps) {
  const [uncontrolled, setUncontrolled] = useState(() => defaultDate ?? new Date())
  const [clock, setClock] = useState(() => new Date())
  const [active, setActive] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const now = fixedNow ?? clock
  const weekStart = weekOf(date ?? uncontrolled, weekStartsOn)
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)

  useEffect(() => {
    if (fixedNow) return
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [fixedNow])

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, scrollToHour - startHour) * hourHeight
  }, [scrollToHour, startHour, hourHeight])

  const weekKey = weekStart.getTime()
  const perDay = useMemo(
    () => days.map((day) => layoutDay(events, day, startHour, endHour, hourHeight)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, weekKey, startHour, endHour, hourHeight],
  )
  const allDay = days.map((day) => events.filter((event) => event.allDay && event.start.getTime() < day.getTime() + DAY_MS && event.end.getTime() > day.getTime()))
  const order = perDay.flat()
  const focusIndex = Math.min(active, order.length - 1)

  const go = (next: Date) => {
    if (date === undefined) setUncontrolled(next)
    setActive(0)
    onDateChange?.(weekOf(next, weekStartsOn))
  }

  const time = (value: Date) => value.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const dayName = (value: Date) => value.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const range = `${days[0].toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`

  const onKeyDown = (event: KeyboardEvent) => {
    // Arrows on the grid itself scroll it; only an event hands them to the roving focus.
    if (!(event.target as HTMLElement).matches('button[data-event]')) return
    const moves: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    let next: number | null = null
    if (event.key in moves) next = (focusIndex + moves[event.key] + order.length) % order.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = order.length - 1
    if (next === null || order.length === 0) return
    event.preventDefault()
    setActive(next)
    buttons.current[next]?.focus()
  }

  const onGridClick = (event: MouseEvent<HTMLDivElement>, day: Date) => {
    if (!onSlotCreate || event.target !== event.currentTarget) return
    const offset = event.clientY - event.currentTarget.getBoundingClientRect().top
    const minutes = Math.floor(((offset / hourHeight) * 60) / slotMinutes) * slotMinutes + startHour * 60
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes)
    onSlotCreate(start, new Date(start.getTime() + slotMinutes * 60_000))
  }

  let running = 0
  const columns = { gridTemplateColumns: '52px repeat(7, minmax(84px, 1fr))' }

  return (
    <section aria-label={label} className={cn('flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <p aria-live="polite" className="text-[15px] font-bold text-ink tabular-nums">
          {range}
        </p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(new Date())} className="mr-1 h-8 rounded-full border border-line px-3 text-[12px] font-bold text-ink hover:bg-surface-muted">
            Today
          </button>
          <IconButton icon={ChevronLeftIcon} label="Previous week" size="xs" tone="bare" onClick={() => go(addDays(weekStart, -7))} />
          <IconButton icon={ChevronRightIcon} label="Next week" size="xs" tone="bare" onClick={() => go(addDays(weekStart, 7))} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid border-b border-line" style={columns}>
            <span aria-hidden="true" className="flex items-end justify-end px-2 pb-1 text-[10px] font-bold text-ink-faint">All day</span>
            {days.map((day, index) => (
              <div key={index} className="flex min-h-[52px] flex-col gap-1 border-l border-line px-1.5 py-1.5">
                <span className={cn('text-[11px] font-bold', sameDay(day, now) ? 'text-ink' : 'text-ink-faint')}>
                  {day.toLocaleDateString(locale, { weekday: 'short' })}{' '}
                  <span className={cn('tabular-nums', sameDay(day, now) && 'rounded-full bg-accent px-1.5 text-accent-ink')}>{day.getDate()}</span>
                </span>
                {allDay[index].map((event) => (
                  <span key={event.id} className="truncate rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold text-ink" style={{ background: event.color ?? 'var(--color-accent-soft)' }}>
                    {event.title}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <div
            ref={scroller}
            role="region"
            aria-label={`${label}, hours`}
            // Focusable so the hours scroll from the keyboard even in a week with no events.
            tabIndex={0}
            className="overflow-y-auto focus-visible:outline-offset-[-2px]"
            style={{ height }}
            onKeyDown={onKeyDown}
          >
            <div className="relative grid" style={{ ...columns, height: hours.length * hourHeight }}>
              <div aria-hidden="true" className="relative">
                {hours.map((hour, index) => (
                  <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] font-bold text-ink-faint tabular-nums" style={{ top: index * hourHeight }}>
                    {index === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}
                  </span>
                ))}
              </div>
              {days.map((day, dayIndex) => {
                const nowTop = ((now.getTime() - day.getTime()) / 3_600_000 - startHour) * hourHeight
                return (
                  <div
                    key={dayIndex}
                    role="group"
                    aria-label={dayName(day)}
                    onClick={(event) => onGridClick(event, day)}
                    className={cn('relative border-l border-line', onSlotCreate && 'cursor-cell')}
                    style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px ${hourHeight}px)` }}
                  >
                    {perDay[dayIndex].map(({ event, top, height: tall, column, columns: count }) => {
                      const index = running++
                      return (
                        <button
                          key={event.id}
                          ref={(node) => {
                            buttons.current[index] = node
                          }}
                          type="button"
                          data-event=""
                          tabIndex={index === focusIndex ? 0 : -1}
                          aria-label={`${event.title}, ${dayName(day)}, ${time(event.start)} to ${time(event.end)}${event.detail ? `, ${event.detail}` : ''}`}
                          onFocus={() => setActive(index)}
                          onClick={() => onEventSelect?.(event)}
                          className="absolute overflow-hidden rounded-[8px] border border-surface px-1.5 py-1 text-left hover:shadow-[var(--shadow-float)] focus-visible:z-10"
                          style={{ top, height: tall, left: `${(column / count) * 100}%`, width: `${100 / count}%`, background: event.color ?? 'var(--color-accent-soft)' }}
                        >
                          <span className="block truncate text-[11px] font-bold leading-tight text-ink">{event.title}</span>
                          {tall > 34 && (
                            <span className="block truncate text-[10px] font-medium text-ink-soft tabular-nums">
                              {time(event.start)}
                              {event.detail ? ` · ${event.detail}` : ''}
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {sameDay(day, now) && nowTop >= 0 && nowTop <= hours.length * hourHeight && (
                      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowTop }}>
                        <span className="-ml-1 size-2 rounded-full bg-danger" />
                        <span className="h-0.5 flex-1 bg-danger" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
