'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { CopyButton } from '../CopyButton'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { Select } from '../Select'
import { ChevronDownIcon, ChevronUpIcon, CrossIcon } from '../internal/icons'

export interface TimezonePlannerZone {
  /** An IANA zone name, such as `Europe/London`. */
  timeZone: string
  /** What the row is called — usually a city or a teammate. */
  label: string
}

export interface TimezonePlannerSelection {
  start: Date
  end: Date
}

export interface TimezonePlannerProps {
  /** Controlled rows. The first row’s day is the one the strip shows. */
  zones?: TimezonePlannerZone[]
  /** Starting rows when uncontrolled. */
  defaultZones?: TimezonePlannerZone[]
  /** Called when a row is added, removed or moved. */
  onZonesChange?: (zones: TimezonePlannerZone[]) => void
  /** Cities offered by the Add menu. */
  cities?: TimezonePlannerZone[]
  /** The day to plan, as `YYYY-MM-DD`. Defaults to today. */
  defaultDate?: string
  /** Local working hours, shaded in every row. */
  workingHours?: { start: number; end: number }
  /** Slot length in minutes. */
  step?: 15 | 30 | 60
  /** Called when the meeting window changes. */
  onSelectionChange?: (selection: TimezonePlannerSelection) => void
  /** Merged last, so it wins. */
  className?: string
}

const CITIES: TimezonePlannerZone[] = [
  { label: 'San Francisco', timeZone: 'America/Los_Angeles' },
  { label: 'New York', timeZone: 'America/New_York' },
  { label: 'São Paulo', timeZone: 'America/Sao_Paulo' },
  { label: 'London', timeZone: 'Europe/London' },
  { label: 'Berlin', timeZone: 'Europe/Berlin' },
  { label: 'Lagos', timeZone: 'Africa/Lagos' },
  { label: 'Dubai', timeZone: 'Asia/Dubai' },
  { label: 'Mumbai', timeZone: 'Asia/Kolkata' },
  { label: 'Kathmandu', timeZone: 'Asia/Kathmandu' },
  { label: 'Singapore', timeZone: 'Asia/Singapore' },
  { label: 'Tokyo', timeZone: 'Asia/Tokyo' },
  { label: 'Sydney', timeZone: 'Australia/Sydney' },
  { label: 'Auckland', timeZone: 'Pacific/Auckland' },
]

const formatters = new Map<string, Intl.DateTimeFormat>()
/** The wall-clock reading of an instant in a zone. Intl knows every zone’s rules, DST included. */
function wall(timeZone: string, instant: number) {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
    formatters.set(timeZone, format)
  }
  const parts = Object.fromEntries(format.formatToParts(instant).map((part) => [part.type, part.value]))
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour % 24, minute: +parts.minute, weekday: parts.weekday as string }
}
/** Minutes ahead of UTC at that instant. */
function offset(timeZone: string, instant: number) {
  const t = wall(timeZone, instant)
  return Math.round((Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute) - Math.floor(instant / 60000) * 60000) / 60000)
}
/** The instant a zone’s calendar day begins. Two passes settle the offset either side of a DST change. */
function midnight(timeZone: string, year: number, month: number, day: number) {
  const local = Date.UTC(year, month - 1, day)
  let guess = local
  for (let pass = 0; pass < 2; pass += 1) guess = local - offset(timeZone, guess) * 60000
  return guess
}
const valid = (timeZone: string) => {
  try {
    wall(timeZone, 0)
    return true
  } catch {
    return false
  }
}
const hhmm = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
const utcLabel = (minutes: number) => `UTC${minutes < 0 ? '−' : '+'}${Math.floor(Math.abs(minutes) / 60)}${Math.abs(minutes) % 60 ? `:${String(Math.abs(minutes) % 60).padStart(2, '0')}` : ''}`
const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * A row per time zone on one shared 24-hour strip, for finding the hour that
 * is reasonable everywhere.
 *
 * The strip is the first row’s calendar day, and every other row reads the same
 * instants on its own clock. Offsets come from Intl for the chosen date, not
 * from a table, so a meeting planned across the week the clocks change is right
 * — and a day with a DST change in the first zone really is 23 or 25 hours long.
 * Working hours are shaded in each row’s local time; the line is now.
 *
 * Drag across the strip to pick a window, or focus it and use the arrows —
 * Shift+arrows change its length. Every row then shows the window on its own
 * clock, and the summary copies as text for an invite.
 */
export function TimezonePlanner({
  zones,
  defaultZones = CITIES.filter((city) => ['San Francisco', 'London', 'Mumbai', 'Tokyo'].includes(city.label)),
  onZonesChange,
  cities = CITIES,
  defaultDate,
  workingHours = { start: 9, end: 17 },
  step = 30,
  onSelectionChange,
  className,
}: TimezonePlannerProps) {
  const [ownZones, setOwnZones] = useState(defaultZones)
  const rows = (zones ?? ownZones).filter((zone) => valid(zone.timeZone))
  const [date, setDate] = useState(defaultDate ?? '')
  const [now, setNow] = useState<number | null>(null)
  const [selection, setSelection] = useState({ start: (9 * 60) / step, length: 60 / step })
  const [message, setMessage] = useState('')
  const strip = useRef<HTMLDivElement>(null)
  const anchor = useRef<number | null>(null)
  const dateId = useId()

  // Today and now are read after mount, so the server and the first client render agree.
  useEffect(() => {
    if (!date) setDate(today())
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [date])

  const setZones = (next: TimezonePlannerZone[]) => {
    if (zones === undefined) setOwnZones(next)
    onZonesChange?.(next)
  }

  const reference = rows[0]
  const home = reference?.timeZone
  const { start, slots } = useMemo(() => {
    const [year, month, day] = (date || '2000-01-01').split('-').map(Number)
    if (!home) return { start: 0, slots: 0 }
    const from = midnight(home, year, month, day)
    const next = new Date(Date.UTC(year, month - 1, day + 1))
    const to = midnight(home, next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
    return { start: from, slots: Math.round((to - from) / (step * 60000)) }
  }, [date, home, step])

  const span = Math.min(selection.length, slots)
  const first = Math.max(0, Math.min(selection.start, slots - span))
  const windowStart = start + first * step * 60000
  const windowEnd = windowStart + span * step * 60000

  useEffect(() => {
    if (slots) onSelectionChange?.({ start: new Date(windowStart), end: new Date(windowEnd) })
  }, [windowStart, windowEnd, slots, onSelectionChange])

  const describe = (zone: TimezonePlannerZone) => {
    const a = wall(zone.timeZone, windowStart)
    const b = wall(zone.timeZone, windowEnd)
    return `${a.weekday} ${hhmm(a.hour, a.minute)}–${a.weekday !== b.weekday ? `${b.weekday} ` : ''}${hhmm(b.hour, b.minute)}`
  }
  const summary = [`Meeting, ${span * step} minutes`, ...rows.map((zone) => `${zone.label}: ${describe(zone)} (${utcLabel(offset(zone.timeZone, windowStart))})`)].join('\n')

  const slotAt = (clientX: number) => {
    const box = strip.current!.getBoundingClientRect()
    return Math.max(0, Math.min(slots - 1, Math.floor(((clientX - box.left) / box.width) * slots)))
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    anchor.current = slotAt(event.clientX)
    setSelection({ start: anchor.current, length: 1 })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (anchor.current === null) return
    const slot = slotAt(event.clientX)
    setSelection({ start: Math.min(anchor.current, slot), length: Math.abs(slot - anchor.current) + 1 })
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const hour = 60 / step
    const moves: Record<string, () => { start: number; length: number }> = {
      ArrowRight: () => (event.shiftKey ? { start: first, length: Math.min(slots - first, span + 1) } : { start: Math.min(slots - span, first + 1), length: span }),
      ArrowLeft: () => (event.shiftKey ? { start: first, length: Math.max(1, span - 1) } : { start: Math.max(0, first - 1), length: span }),
      PageUp: () => ({ start: Math.max(0, first - hour), length: span }),
      PageDown: () => ({ start: Math.min(slots - span, first + hour), length: span }),
      Home: () => ({ start: 0, length: span }),
      End: () => ({ start: slots - span, length: span }),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    setSelection(move())
  }

  const move = (index: number, by: number) => {
    const next = rows.slice()
    const [zone] = next.splice(index, 1)
    next.splice(index + by, 0, zone)
    setZones(next)
    setMessage(`${zone.label} moved to position ${index + by + 1}${index + by === 0 ? ', and the strip now follows its day' : ''}.`)
  }

  const available = cities.filter((city) => !rows.some((zone) => zone.timeZone === city.timeZone && zone.label === city.label))
  const nowAt = now !== null && now >= start && now < start + slots * step * 60000 ? (now - start) / (slots * step * 60000) : null
  const hourSlots = Array.from({ length: Math.ceil(slots / (60 / step)) }, (_, hour) => hour * (60 / step))

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={dateId} className="text-[12px] font-semibold text-ink-soft">
            Day{reference ? ` in ${reference.label}` : ''}
          </label>
          <Input id={dateId} type="date" inputSize="sm" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} containerClassName="w-[170px]" />
        </div>
        {available.length > 0 && (
          <Select
            label="Add a city"
            size="sm"
            value=""
            onValueChange={(value) => {
              const city = available.find((option) => `${option.label}|${option.timeZone}` === value)
              if (!city) return
              setZones([...rows, city])
              setMessage(`${city.label} added.`)
            }}
            options={[{ value: '', label: 'Add a city…', disabled: true }, ...available.map((city) => ({ value: `${city.label}|${city.timeZone}`, label: city.label, hint: utcLabel(offset(city.timeZone, windowStart || 0)) }))]}
          />
        )}
        <CopyButton value={summary} label="Copy summary" size="sm" className="ml-auto" />
      </div>

      <div className="max-w-full overflow-x-auto rounded-[var(--radius-tile)] border border-line">
        <div className="flex min-w-[620px]">
          <div className="w-[184px] shrink-0 border-r border-line">
            <div className="h-6 border-b border-line bg-surface-sunken" />
            {rows.map((zone, index) => (
              <div key={`${zone.label}-${zone.timeZone}`} className="flex h-11 items-center gap-1 border-b border-line px-2 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12px] font-bold text-ink">
                    {zone.label}
                    {index === 0 && <span className="ml-1 text-[10px] font-semibold text-ink-faint">· home</span>}
                  </span>
                  <span className="truncate text-[10px] font-semibold text-ink-faint tabular">
                    {utcLabel(offset(zone.timeZone, windowStart))} · {describe(zone)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col">
                  <IconButton icon={ChevronUpIcon} label={`Move ${zone.label} up`} size="xs" className="size-5" disabled={index === 0} onClick={() => move(index, -1)} />
                  <IconButton icon={ChevronDownIcon} label={`Move ${zone.label} down`} size="xs" className="size-5" disabled={index === rows.length - 1} onClick={() => move(index, 1)} />
                </div>
                <IconButton
                  icon={CrossIcon}
                  label={`Remove ${zone.label}`}
                  size="xs"
                  disabled={rows.length === 1}
                  onClick={() => {
                    setZones(rows.filter((_, at) => at !== index))
                    setMessage(`${zone.label} removed.`)
                  }}
                />
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex h-6 items-center border-b border-line bg-surface-sunken" aria-hidden="true">
              {hourSlots.map((slot) => {
                const t = reference ? wall(reference.timeZone, start + slot * step * 60000) : null
                return (
                  <span key={slot} className="flex-1 text-center text-[9px] font-bold text-ink-faint tabular">
                    {t && t.hour % 3 === 0 ? hhmm(t.hour, t.minute) : ''}
                  </span>
                )
              })}
            </div>
            <div className="relative">
              {rows.map((zone) => (
                <div key={`${zone.label}-${zone.timeZone}`} className="flex h-11 border-b border-line last:border-b-0" aria-hidden="true">
                  {Array.from({ length: slots }, (_, slot) => {
                    const t = wall(zone.timeZone, start + slot * step * 60000)
                    const minutes = t.hour * 60 + t.minute
                    const working = minutes >= workingHours.start * 60 && minutes < workingHours.end * 60
                    const night = t.hour < 7 || t.hour >= 22
                    const newDay = slot > 0 && t.hour === 0 && t.minute < step
                    const labelled = t.minute < step && (step === 60 || t.hour % 2 === 0)
                    return (
                      <span
                        key={slot}
                        className={cn(
                          'relative flex min-w-0 flex-1 items-center justify-center overflow-visible text-[9px] font-bold tabular',
                          working
                            ? 'bg-[color-mix(in_oklab,var(--color-accent)_38%,var(--color-surface))] text-ink'
                            : night
                              ? 'bg-surface-muted text-ink-faint'
                              : 'bg-surface text-ink-soft',
                          newDay && 'border-l-2 border-ink',
                        )}
                      >
                        {labelled || newDay ? (newDay ? t.weekday : t.hour) : ''}
                      </span>
                    )
                  })}
                </div>
              ))}

              <div
                ref={strip}
                role="slider"
                tabIndex={0}
                aria-label="Meeting window"
                aria-valuemin={0}
                aria-valuemax={Math.max(0, slots - span)}
                aria-valuenow={first}
                aria-valuetext={rows.map((zone) => `${zone.label} ${describe(zone)}`).join('; ')}
                aria-describedby={`${dateId}-help`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (anchor.current = null)}
                onPointerCancel={() => (anchor.current = null)}
                onKeyDown={onKeyDown}
                className="absolute inset-0 cursor-col-resize touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
              >
                {slots > 0 && (
                  <span
                    className="pointer-events-none absolute inset-y-0 rounded-[var(--radius-6)] border-2 border-ink bg-[color-mix(in_oklab,var(--color-ink)_8%,transparent)]"
                    style={{ left: `${(first / slots) * 100}%`, width: `${(span / slots) * 100}%` }}
                  />
                )}
                {nowAt !== null && (
                  <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-danger" style={{ left: `${nowAt * 100}%` }} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p id={`${dateId}-help`} className="m-0 text-[11px] font-medium text-ink-faint">
        Drag across the strip, or focus it and use the arrow keys; Shift+arrows change the length. The red line is now.
      </p>
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
