'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { StatusPill } from '../internal/StatusPill'

export type SlaTimerWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface SlaTimerCalendar {
  /** IANA zone the hours are kept in, e.g. `Europe/London`. */
  timeZone: string
  /** Working hours per weekday (0 is Sunday), as `['09:00', '17:30']` spans. A missing day is closed. */
  hours: Partial<Record<SlaTimerWeekday, [string, string][]>>
  /** Closed dates in the zone, as `YYYY-MM-DD`. */
  holidays?: string[]
}

export interface SlaTimerPause {
  start: Date
  /** Leave out while the pause is still running. */
  end?: Date
  /** Shown while this pause is in force — "Waiting on customer". */
  reason?: string
}

export type SlaTimerState = 'running' | 'warning' | 'breached' | 'paused'

export interface SlaTimerProps {
  /** What the target is for — "First response", "Resolution". */
  label: string
  /** When the clock started. */
  start: Date
  /** The target, in business minutes. */
  targetMinutes: number
  calendar: SlaTimerCalendar
  /** Spans that do not count, such as waiting on the customer. */
  pauses?: SlaTimerPause[]
  /** The current time. Leave out to tick every second. */
  now?: Date
  /** Warn when this share of the target or less remains. */
  warnAt?: number
  /** Merged last, so it wins. */
  className?: string
}

const MINUTE = 60_000
const formatters = new Map<string, Intl.DateTimeFormat>()

function zoned(ms: number, timeZone: string) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(timeZone, format)
  }
  const parts: Record<string, number> = {}
  for (const part of format.formatToParts(new Date(ms))) if (part.type !== 'literal') parts[part.type] = Number(part.value)
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute, second: parts.second }
}

/** The zone's offset from UTC at an instant, read from Intl so daylight saving is whatever the zone says it is. */
function offsetAt(ms: number, timeZone: string) {
  const p = zoned(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

/** The instant a wall-clock time happens in a zone. Checked twice, so a time next to a DST change lands on the right side. */
function wallToInstant(year: number, month: number, day: number, minutes: number, timeZone: string) {
  const wall = Date.UTC(year, month - 1, day, 0, minutes)
  let instant = wall - offsetAt(wall, timeZone)
  const second = offsetAt(instant, timeZone)
  if (second !== wall - instant) instant = wall - second
  return instant
}

const toMinutes = (clock: string) => {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Working spans from the day containing `from`, in order, with the pauses cut out. */
function* businessSpans(from: number, calendar: SlaTimerCalendar, pauses: SlaTimerPause[] = []) {
  const holidays = new Set(calendar.holidays ?? [])
  const cuts = pauses.map((pause) => [pause.start.getTime(), pause.end?.getTime() ?? Infinity]).sort((a, b) => a[0] - b[0])
  if (!Object.values(calendar.hours).some((spans) => spans?.length)) return
  const first = zoned(from, calendar.timeZone)
  let cursor = Date.UTC(first.year, first.month - 1, first.day)
  for (let guard = 0; guard < 3660; guard += 1, cursor += 86_400_000) {
    const date = new Date(cursor)
    const [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (holidays.has(key)) continue
    for (const [open, close] of calendar.hours[date.getUTCDay() as SlaTimerWeekday] ?? []) {
      let a = wallToInstant(y, m, d, toMinutes(open), calendar.timeZone)
      const b = wallToInstant(y, m, d, toMinutes(close), calendar.timeZone)
      if (b <= from) continue
      a = Math.max(a, from)
      for (const [ps, pe] of cuts) {
        if (pe <= a || ps >= b) continue
        if (ps > a) yield [a, ps] as const
        if (pe === Infinity) return
        a = Math.max(a, pe)
        if (a >= b) break
      }
      if (a < b) yield [a, b] as const
    }
  }
}

/** Business milliseconds between two instants under a calendar, not counting pauses. */
export function businessTimeBetween(start: Date, end: Date, calendar: SlaTimerCalendar, pauses?: SlaTimerPause[]) {
  let total = 0
  const stop = end.getTime()
  for (const [a, b] of businessSpans(start.getTime(), calendar, pauses)) {
    if (a >= stop) break
    total += Math.min(b, stop) - a
  }
  return total
}

/**
 * The instant `durationMs` of business time after `start`. Null when it never
 * arrives — an open-ended pause, or a calendar with no working hours.
 */
export function addBusinessTime(start: Date, durationMs: number, calendar: SlaTimerCalendar, pauses?: SlaTimerPause[]) {
  let remaining = durationMs
  for (const [a, b] of businessSpans(start.getTime(), calendar, pauses)) {
    if (b === Infinity) return null
    if (remaining <= b - a) return new Date(a + remaining)
    remaining -= b - a
  }
  return null
}

const span = (ms: number) => {
  const total = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
const spoken = (ms: number) => {
  const minutes = Math.round(Math.abs(ms) / MINUTE)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} hour${h === 1 ? '' : 's'}`, (m || !h) && `${m} minute${m === 1 ? '' : 's'}`].filter(Boolean).join(' ')
}

/**
 * A countdown to a service-level target that only counts business time: the
 * zone's working hours, minus holidays, minus pauses such as waiting on the
 * customer.
 *
 * An SLA clock that counts wall time says a ticket raised at 17:55 on Friday
 * breached by Monday, which trains everyone to ignore it. This one does the
 * calendar arithmetic properly — hours are wall-clock in the calendar's IANA
 * zone, resolved through Intl, so a daylight-saving change never adds or loses
 * an hour — and when the clock is stopped it says why and when it restarts.
 * The same arithmetic is exported as addBusinessTime and businessTimeBetween.
 */
export function SlaTimer({
  label,
  start,
  targetMinutes,
  calendar,
  pauses = [],
  now: nowProp,
  warnAt = 0.25,
  className,
}: SlaTimerProps) {
  const [tick, setTick] = useState(() => nowProp ?? new Date())
  useEffect(() => {
    if (nowProp) return
    const timer = window.setInterval(() => setTick(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [nowProp])
  const now = nowProp ?? tick

  let result
  try {
    const target = targetMinutes * MINUTE
    const elapsed = businessTimeBetween(start, now, calendar, pauses)
    const due = addBusinessTime(start, target, calendar, pauses)
    const active = pauses.find((pause) => pause.start <= now && (!pause.end || pause.end > now))
    const [next] = businessSpans(now.getTime(), calendar)
    const working = !!next && next[0] <= now.getTime()
    const remaining = target - elapsed
    const state: SlaTimerState = remaining <= 0 ? 'breached' : active || !working ? 'paused' : remaining <= target * warnAt ? 'warning' : 'running'
    result = { target, elapsed, due, active, next, working, remaining, state }
  } catch {
    return (
      <p role="alert" className={cn('text-[12px] font-semibold text-danger', className)}>
        This browser cannot resolve the time zone “{calendar.timeZone}”, so the business-time clock is unavailable.
      </p>
    )
  }
  const { target, elapsed, due, active, next, working, remaining, state } = result
  const when = (ms: number) =>
    new Intl.DateTimeFormat(undefined, { timeZone: calendar.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(ms)
  const zone = calendar.timeZone.split('/').pop()?.replace(/_/g, ' ')
  const share = Math.min(1, elapsed / (target || 1))

  const explanation =
    state === 'breached'
      ? `Breached ${spoken(remaining)} of business time ago${due ? `, due ${when(due.getTime())}` : ''}.`
      : active
        ? `Paused: ${active.reason ?? 'on hold'}${active.end ? ` until ${when(active.end.getTime())}` : ''}.`
        : !working
          ? `Paused: outside business hours${next ? ` · resumes ${when(next[0])}` : ''}.`
          : `${spoken(remaining)} of business time left.`

  const tone = { running: 'success', warning: 'warning', breached: 'danger', paused: 'neutral' } as const
  const word = { running: 'On track', warning: 'At risk', breached: 'Breached', paused: 'Paused' }[state]

  return (
    <div className={cn('flex w-full flex-col gap-2 rounded-[var(--radius-tile)] border border-line bg-surface p-3.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-bold text-ink-soft">{label}</span>
        <StatusPill tone={tone[state]}>{word}</StatusPill>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className={cn('font-mono text-[26px] font-bold tabular-nums tracking-tight', state === 'breached' ? 'text-danger' : 'text-ink')}
        >
          {state === 'breached' ? '−' : ''}
          {span(remaining)}
        </span>
        <span className="text-[11px] font-semibold text-ink-faint">{state === 'breached' ? 'over' : 'left'} of {spoken(target)}</span>
      </div>
      <div
        role="meter"
        aria-label={`${label}: business time used`}
        aria-valuemin={0}
        aria-valuemax={targetMinutes}
        aria-valuenow={Math.round(Math.min(elapsed, target) / MINUTE)}
        aria-valuetext={`${spoken(elapsed)} of ${spoken(target)} used`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-track"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none',
            state === 'breached' ? 'bg-danger' : state === 'warning' ? 'bg-warning' : state === 'paused' ? 'bg-ink-faint' : 'bg-success',
          )}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <p className="text-[12px] font-medium text-ink-soft">{explanation}</p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`${label}: ${word}.${active ? ` ${active.reason ?? ''}` : ''}`}
      </p>
      <p className="text-[11px] font-medium text-ink-faint">
        {due ? `Due ${when(due.getTime())}` : 'No due time while paused'} · {zone} time
      </p>
    </div>
  )
}
