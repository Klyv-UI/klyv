'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Popover } from '../Popover'
import { VisuallyHidden } from '../VisuallyHidden'
import { toISODate } from '../Calendar'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

export type EventCalendarTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger'

export interface EventCalendarEvent {
  id: string
  title: string
  /** First day, as yyyy-mm-dd. */
  date: string
  /** Last day of an event that spans several, as yyyy-mm-dd. Inclusive. */
  end?: string
  /** Shown before the title, e.g. "09:30". Omit for an all-day event. */
  time?: string
  /** Chip colour. */
  tone?: EventCalendarTone
}

export interface EventCalendarProps {
  events: EventCalendarEvent[]
  /** The month shown, as yyyy-mm. Pass it to control navigation. */
  month?: string
  /** Starting month when uncontrolled, as yyyy-mm. Defaults to the month of `today`. */
  defaultMonth?: string
  /** Called when prev, next, today or the keyboard changes month. */
  onMonthChange?: (month: string) => void
  /** 0 starts weeks on Sunday, 1 on Monday. */
  weekStartsOn?: 0 | 1
  /** Chips shown in a day before the rest collapse into "+n more". */
  maxPerDay?: number
  /** Called when an event chip is chosen. */
  onEventClick?: (event: EventCalendarEvent) => void
  /** Called when a day is clicked, or Enter is pressed on it. */
  onDayClick?: (date: string) => void
  /** Today, as yyyy-mm-dd. Defaults to the system date. */
  today?: string
  /** Accessible name for the grid. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

const TONES: Record<EventCalendarTone, string> = {
  accent: 'bg-accent-soft text-ink before:bg-accent-strong',
  neutral: 'bg-surface-muted text-ink-soft before:bg-line-strong',
  success: 'bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)] text-success before:bg-success',
  warning: 'bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-ink before:bg-warning',
  danger: 'bg-[color-mix(in_oklab,var(--color-danger)_10%,transparent)] text-danger before:bg-danger',
}

const parse = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}
const shift = (iso: string, days: number) => {
  const date = parse(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}
const shiftMonth = (iso: string, delta: number) => {
  const date = parse(iso)
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), last))
  return toISODate(target)
}
const longDate = (iso: string) =>
  parse(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * A month of events, for schedules that are read by the week rather than by
 * the hour — content calendars, rotas, launches.
 *
 * Each day keeps a fixed height and shows its first few events as chips; the
 * rest collapse into "+n more", which opens the whole day in a popover. A
 * month view that grows rows to fit the busiest day makes every other week
 * jump when one fills up.
 *
 * The grid follows the date-grid keyboard model — arrows by day and week, Home
 * and End to the ends of the week, PageUp and PageDown by month — with one tab
 * stop. Tab from a day walks into that day's chips only, so reaching the
 * event on the 28th is not forty tab presses.
 */
export function EventCalendar({
  events,
  month,
  defaultMonth,
  onMonthChange,
  weekStartsOn = 1,
  maxPerDay = 2,
  onEventClick,
  onDayClick,
  today: todayProp,
  label = 'Events',
  className,
}: EventCalendarProps) {
  const today = todayProp ?? toISODate(new Date())
  const [ownMonth, setOwnMonth] = useState(defaultMonth ?? today.slice(0, 7))
  const view = month ?? ownMonth
  const [focused, setFocused] = useState(today.slice(0, 7) === view ? today : `${view}-01`)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const moveFocus = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const setMonth = (next: string) => {
    if (next === view) return
    if (month === undefined) setOwnMonth(next)
    onMonthChange?.(next)
  }

  const byDay = useMemo(() => {
    const map = new Map<string, EventCalendarEvent[]>()
    for (const event of events) {
      let day = event.date
      // Capped so a malformed end date cannot spin forever.
      for (let guard = 0; guard < 366 && day <= (event.end ?? event.date); guard++) {
        map.set(day, [...(map.get(day) ?? []), event])
        day = shift(day, 1)
      }
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    return map
  }, [events])

  const days = useMemo(() => {
    const first = parse(`${view}-01`)
    const offset = (first.getDay() - weekStartsOn + 7) % 7
    const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const weeks = Math.ceil((offset + length) / 7)
    const start = toISODate(new Date(first.getFullYear(), first.getMonth(), 1 - offset))
    return Array.from({ length: weeks * 7 }, (_, index) => shift(start, index))
  }, [view, weekStartsOn])

  const tabDay = days.includes(focused) && focused.startsWith(view) ? focused : `${view}-01`

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${tabDay}"]`)?.focus()
  }, [tabDay])

  const go = (iso: string) => {
    moveFocus.current = true
    setFocused(iso)
    setMonth(iso.slice(0, 7))
  }

  const onCellKeyDown = (event: KeyboardEvent<HTMLDivElement>, iso: string) => {
    if (event.target !== event.currentTarget) return
    const weekday = (parse(iso).getDay() - weekStartsOn + 7) % 7
    const keys: Record<string, () => void> = {
      ArrowRight: () => go(shift(iso, 1)),
      ArrowLeft: () => go(shift(iso, -1)),
      ArrowDown: () => go(shift(iso, 7)),
      ArrowUp: () => go(shift(iso, -7)),
      Home: () => go(shift(iso, -weekday)),
      End: () => go(shift(iso, 6 - weekday)),
      PageDown: () => go(shiftMonth(iso, 1)),
      PageUp: () => go(shiftMonth(iso, -1)),
      Enter: () => onDayClick?.(iso),
      ' ': () => onDayClick?.(iso),
    }
    const handler = keys[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  const navigate = (next: string) => {
    setFocused(next)
    setMonth(next.slice(0, 7))
  }

  const chip = (event: EventCalendarEvent, tabbable: boolean, onChosen?: () => void) => (
    <button
      type="button"
      tabIndex={tabbable ? 0 : -1}
      onClick={() => {
        onEventClick?.(event)
        onChosen?.()
      }}
      className={cn(
        'relative flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-[6px] py-0.5 pl-2 pr-1.5 text-left text-[11px] font-semibold leading-tight',
        'before:absolute before:inset-y-0.5 before:left-0.5 before:w-[3px] before:rounded-full',
        'transition-[filter] hover:brightness-95',
        TONES[event.tone ?? 'accent'],
      )}
    >
      {event.time && <span className="shrink-0 tabular-nums opacity-80">{event.time}</span>}
      <span className="truncate">{event.title}</span>
    </button>
  )

  const monthTitle = parse(`${view}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        <div aria-live="polite" className="flex-1 text-[15px] font-bold tracking-[-0.01em] text-ink">
          {monthTitle}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(today)}>
          Today
        </Button>
        <IconButton icon={ChevronLeftIcon} label="Previous month" size="sm" tone="plain" onClick={() => navigate(shiftMonth(tabDay, -1))} />
        <IconButton icon={ChevronRightIcon} label="Next month" size="sm" tone="plain" onClick={() => navigate(shiftMonth(tabDay, 1))} />
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-tile)] border border-line bg-surface">
        <div ref={gridRef} role="grid" aria-label={`${label}, ${monthTitle}`} className="min-w-[560px]">
          <div role="row" className="grid grid-cols-7 border-b border-line">
            {days.slice(0, 7).map((iso) => (
              <div key={iso} role="columnheader" className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                <abbr title={parse(iso).toLocaleDateString(undefined, { weekday: 'long' })} className="no-underline">
                  {parse(iso).toLocaleDateString(undefined, { weekday: 'short' })}
                </abbr>
              </div>
            ))}
          </div>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <div key={week} role="row" className="grid grid-cols-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
              {days.slice(week * 7, week * 7 + 7).map((iso) => {
                const list = byDay.get(iso) ?? []
                const inMonth = iso.startsWith(view)
                const active = iso === tabDay
                const overflow = Math.max(0, list.length - maxPerDay)
                const shown = list.slice(0, maxPerDay)
                return (
                  <div
                    key={iso}
                    role="gridcell"
                    data-day={iso}
                    tabIndex={active ? 0 : -1}
                    aria-current={iso === today ? 'date' : undefined}
                    onKeyDown={(event) => onCellKeyDown(event, iso)}
                    onFocus={() => setFocused(iso)}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest('button')) return
                      onDayClick?.(iso)
                    }}
                    className={cn(
                      'flex min-h-[96px] min-w-0 flex-col gap-0.5 p-1 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-line',
                      'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
                      !inMonth && 'bg-surface-sunken',
                      onDayClick && 'cursor-pointer',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mb-0.5 flex size-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                        iso === today ? 'bg-accent text-accent-ink' : inMonth ? 'text-ink' : 'text-ink-faint',
                      )}
                    >
                      {parse(iso).getDate()}
                    </span>
                    <VisuallyHidden>
                      {longDate(iso)}
                      {list.length ? `, ${list.length} ${list.length === 1 ? 'event' : 'events'}` : ', no events'}
                    </VisuallyHidden>
                    {shown.map((event) => (
                      <div key={event.id}>{chip(event, active)}</div>
                    ))}
                    {overflow > 0 && (
                      <Popover
                        open={openDay === iso}
                        onOpenChange={(open) => setOpenDay(open ? iso : null)}
                        label={longDate(iso)}
                        initialFocus
                        className="w-[240px] p-2"
                        trigger={
                          <button
                            type="button"
                            tabIndex={active ? 0 : -1}
                            aria-haspopup="dialog"
                            aria-expanded={openDay === iso}
                            className="rounded-[6px] px-1.5 py-0.5 text-left text-[11px] font-bold text-ink-soft hover:bg-surface-muted hover:text-ink"
                          >
                            +{overflow} more
                            <VisuallyHidden> events on {longDate(iso)}</VisuallyHidden>
                          </button>
                        }
                      >
                        <p className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{longDate(iso)}</p>
                        <ul className="flex flex-col gap-1">
                          {list.map((event) => (
                            <li key={event.id}>{chip(event, true, () => setOpenDay(null))}</li>
                          ))}
                        </ul>
                      </Popover>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
