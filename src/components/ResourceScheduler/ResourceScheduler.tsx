'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { SegmentedControl } from '../SegmentedControl'
import { PlotAnnouncer } from '../internal/plot'

export type ResourceSchedulerZoom = 'day' | 'week'
export type ResourceSchedulerConflicts = 'refuse' | 'flag'

export interface ResourceSchedulerResource {
  id: string
  label: string
  /** A second line under the name — a capacity, a role. */
  detail?: string
}

export interface ResourceSchedulerBooking {
  id: string
  resourceId: string
  start: Date
  end: Date
  title: string
}

export interface ResourceSchedulerProps {
  /** One row each. */
  resources: ResourceSchedulerResource[]
  /** Controlled bookings. */
  bookings?: ResourceSchedulerBooking[]
  /** Bookings when uncontrolled. */
  defaultBookings?: ResourceSchedulerBooking[]
  /** Called with the full list after a create, move, resize or delete. */
  onBookingsChange?: (bookings: ResourceSchedulerBooking[]) => void
  /** The day shown, or any day in the week shown. */
  date: Date
  /** Controlled zoom. */
  zoom?: ResourceSchedulerZoom
  /** Zoom when uncontrolled. */
  defaultZoom?: ResourceSchedulerZoom
  onZoomChange?: (zoom: ResourceSchedulerZoom) => void
  /** First bookable hour of each day. */
  dayStartHour?: number
  /** Hour each day ends. */
  dayEndHour?: number
  /** Every start and end lands on a multiple of this many minutes. */
  snapMinutes?: number
  /** Refuse an overlapping booking on the same resource, or allow it and mark both. */
  conflicts?: ResourceSchedulerConflicts
  /** Where the now line is drawn. Defaults to the current time. */
  now?: Date
  /** Title given to a booking made by dragging or with Enter. */
  newBookingTitle?: string
  /** Accessible name for the schedule. */
  label: string
  /** Merged last, so it wins. */
  className?: string
}

const ROW_H = 52
const HEADER_H = 30
const DAY = 86_400_000
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const clock = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const overlaps = (a: ResourceSchedulerBooking, b: ResourceSchedulerBooking) =>
  a.id !== b.id && a.resourceId === b.resourceId && a.start < b.end && b.start < a.end
let serial = 0

type Drag = {
  kind: 'create' | 'move' | 'start' | 'end'
  booking: ResourceSchedulerBooking
  draft: ResourceSchedulerBooking
  x: number
  y: number
  moved: boolean
}

/**
 * Bookings on a grid of resources against time: drag empty space to book,
 * drag a booking to move it (to another row too), drag its edges to resize.
 *
 * Every change snaps to the interval, because a room booked from 09:07 is a
 * gap nobody else can use. Overlaps on one resource are either refused — the
 * booking springs back and the reason is announced — or allowed and marked,
 * for teams that double-book on purpose. The keyboard does everything the
 * pointer does: the grid is one tab stop with a cursor (arrows, Enter to
 * book), each booking is a button (arrows move it, Shift+arrows resize it,
 * Delete removes it).
 */
export function ResourceScheduler({
  resources,
  bookings: bookingsProp,
  defaultBookings = [],
  onBookingsChange,
  date,
  zoom: zoomProp,
  defaultZoom = 'day',
  onZoomChange,
  dayStartHour = 8,
  dayEndHour = 18,
  snapMinutes = 15,
  conflicts = 'refuse',
  now: nowProp,
  newBookingTitle = 'New booking',
  label,
  className,
}: ResourceSchedulerProps) {
  const hintId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState(defaultBookings)
  const bookings = bookingsProp ?? state
  const [zoomState, setZoomState] = useState(defaultZoom)
  const zoom = zoomProp ?? zoomState
  const [drag, setDrag] = useState<Drag | null>(null)
  const [cursor, setCursor] = useState<{ row: number; minutes: number } | null>(null)
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => nowProp ?? new Date())
  useEffect(() => {
    if (nowProp) return setNow(nowProp)
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [nowProp])

  const span = dayEndHour - dayStartHour
  const step = zoom === 'week' ? Math.max(snapMinutes, 30) : snapMinutes
  const first = zoom === 'day' ? startOfDay(date) : addDays(startOfDay(date), -((date.getDay() + 6) % 7))
  const days = Array.from({ length: zoom === 'day' ? 1 : 7 }, (_, index) => addDays(first, index))
  const dayW = zoom === 'day' ? span * 76 : 150
  const width = days.length * dayW
  const xOf = (time: Date) => {
    const index = Math.round((startOfDay(time).getTime() - first.getTime()) / DAY)
    const hours = time.getHours() + time.getMinutes() / 60 - dayStartHour
    return index * dayW + (Math.min(span, Math.max(0, hours)) / span) * dayW
  }
  const timeAt = (x: number, round = Math.round) => {
    const index = Math.min(days.length - 1, Math.max(0, Math.floor(x / dayW)))
    const within = Math.min(1, Math.max(0, (x - index * dayW) / dayW))
    const minutes = round((within * span * 60) / step) * step
    const day = days[index]
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), dayStartHour, minutes)
  }
  const dayEnd = (time: Date) => new Date(time.getFullYear(), time.getMonth(), time.getDate(), dayEndHour)
  const dayStart = (time: Date) => new Date(time.getFullYear(), time.getMonth(), time.getDate(), dayStartHour)

  const commit = (next: ResourceSchedulerBooking[]) => {
    if (bookingsProp === undefined) setState(next)
    onBookingsChange?.(next)
  }
  const describe = (booking: ResourceSchedulerBooking) =>
    `${booking.title}, ${resources.find((entry) => entry.id === booking.resourceId)?.label ?? ''}, ${booking.start.toLocaleDateString(undefined, { weekday: 'short' })} ${clock(booking.start)} to ${clock(booking.end)}`

  /** Applies a change, honouring the conflict rule. Returns whether it stuck. */
  const apply = (draft: ResourceSchedulerBooking, isNew: boolean) => {
    const clash = bookings.find((other) => overlaps(draft, other))
    if (clash && conflicts === 'refuse') {
      setMessage(`Not saved: overlaps ${clash.title}, ${clock(clash.start)} to ${clock(clash.end)}.`)
      return false
    }
    commit(isNew ? [...bookings, draft] : bookings.map((entry) => (entry.id === draft.id ? draft : entry)))
    setMessage(`${isNew ? 'Booked' : 'Moved'} ${describe(draft)}${clash ? '. Overlaps another booking.' : '.'}`)
    return true
  }

  const shift = (booking: ResourceSchedulerBooking, minutes: number, resize: boolean, rowDelta = 0) => {
    const row = Math.min(resources.length - 1, Math.max(0, resources.findIndex((entry) => entry.id === booking.resourceId) + rowDelta))
    const start = resize ? booking.start : new Date(booking.start.getTime() + minutes * 60_000)
    let end = new Date(booking.end.getTime() + minutes * 60_000)
    if (resize && end.getTime() - start.getTime() < step * 60_000) end = new Date(start.getTime() + step * 60_000)
    if (start < dayStart(booking.start) || end > dayEnd(booking.start)) return booking
    return { ...booking, resourceId: resources[row].id, start, end }
  }

  const point = (event: ReactPointerEvent) => {
    const rect = bodyRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const { x, y } = point(event)
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-booking]')
    const existing = target ? bookings.find((entry) => entry.id === target.dataset.booking) : undefined
    const edge = (event.target as HTMLElement).dataset.edge as 'start' | 'end' | undefined
    let next: Drag
    if (existing) next = { kind: edge ?? 'move', booking: existing, draft: existing, x, y, moved: false }
    else {
      const row = Math.floor(y / ROW_H)
      if (!resources[row]) return
      const start = timeAt(x, Math.floor)
      const draft = { id: `booking-${Date.now().toString(36)}-${(serial += 1)}`, resourceId: resources[row].id, start, end: start, title: newBookingTitle }
      next = { kind: 'create', booking: draft, draft, x, y, moved: false }
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag(next)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return
    const { x, y } = point(event)
    const { booking } = drag
    const moved = drag.moved || Math.abs(x - drag.x) > 3 || Math.abs(y - drag.y) > 3
    let draft = booking
    if (drag.kind === 'create') {
      const [a, b] = [booking.start, timeAt(x)]
      draft = { ...booking, start: a < b ? a : b, end: a < b ? b : a }
      if (draft.end.getDate() !== draft.start.getDate()) draft.end = dayEnd(draft.start)
    } else if (drag.kind === 'move') {
      const length = booking.end.getTime() - booking.start.getTime()
      let start = timeAt(xOf(booking.start) + x - drag.x)
      if (start.getTime() + length > dayEnd(start).getTime()) start = new Date(dayEnd(start).getTime() - length)
      const row = Math.min(resources.length - 1, Math.max(0, Math.floor(y / ROW_H)))
      draft = { ...booking, resourceId: resources[row].id, start, end: new Date(start.getTime() + length) }
    } else {
      const time = timeAt(xOf(drag.kind === 'start' ? booking.start : booking.end) + x - drag.x)
      const minimum = step * 60_000
      if (drag.kind === 'start') draft = { ...booking, start: new Date(Math.min(time.getTime(), booking.end.getTime() - minimum)) }
      else draft = { ...booking, end: new Date(Math.max(time.getTime(), booking.start.getTime() + minimum)) }
    }
    setDrag({ ...drag, draft, moved })
  }

  const onPointerUp = () => {
    if (!drag) return
    setDrag(null)
    if (drag.kind === 'create') {
      const draft = drag.draft.end > drag.draft.start ? drag.draft : { ...drag.draft, end: new Date(drag.draft.start.getTime() + 60 * 60_000) }
      if (draft.end > dayEnd(draft.start)) draft.end = dayEnd(draft.start)
      apply(draft, true)
    } else if (drag.moved) apply(drag.draft, false)
  }

  const onBodyKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const current = cursor ?? { row: 0, minutes: 60 }
    const total = days.length * span * 60
    const moves: Record<string, () => { row: number; minutes: number }> = {
      ArrowLeft: () => ({ ...current, minutes: Math.max(0, current.minutes - step) }),
      ArrowRight: () => ({ ...current, minutes: Math.min(total - step, current.minutes + step) }),
      ArrowUp: () => ({ ...current, row: Math.max(0, current.row - 1) }),
      ArrowDown: () => ({ ...current, row: Math.min(resources.length - 1, current.row + 1) }),
    }
    if (moves[event.key]) {
      event.preventDefault()
      const next = moves[event.key]()
      setCursor(next)
      const time = timeAt((next.minutes / (span * 60)) * dayW)
      setMessage(`${resources[next.row].label}, ${time.toLocaleDateString(undefined, { weekday: 'short' })} ${clock(time)}`)
    } else if (event.key === 'Enter' && cursor) {
      event.preventDefault()
      const start = timeAt((cursor.minutes / (span * 60)) * dayW)
      const end = new Date(Math.min(start.getTime() + 60 * 60_000, dayEnd(start).getTime()))
      apply({ id: `booking-${Date.now().toString(36)}-${(serial += 1)}`, resourceId: resources[cursor.row].id, start, end, title: newBookingTitle }, true)
    } else if (event.key === 'Escape' && cursor) setCursor(null)
  }

  const onBookingKey = (event: KeyboardEvent<HTMLButtonElement>, booking: ResourceSchedulerBooking) => {
    const deltas: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (deltas[event.key]) {
      event.preventDefault()
      event.stopPropagation()
      const [minutes, rows] = deltas[event.key]
      const next = event.shiftKey && rows !== 0 ? booking : shift(booking, minutes, event.shiftKey, rows)
      if (next !== booking && apply(next, false)) {
        const target = event.currentTarget
        requestAnimationFrame(() => target.isConnected && target.focus())
      }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      commit(bookings.filter((entry) => entry.id !== booking.id))
      setMessage(`Removed ${booking.title}.`)
      bodyRef.current?.focus()
    } else if (event.key === 'Escape') bodyRef.current?.focus()
  }

  const shown = drag ? [...bookings.filter((entry) => entry.id !== drag.draft.id), drag.draft] : bookings
  const nowX = now >= dayStart(days[0]) && now <= dayEnd(days[days.length - 1]) ? xOf(now) : null
  const hours = Array.from({ length: span }, (_, index) => dayStartHour + index)

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">
          {zoom === 'day'
            ? first.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
            : `Week of ${first.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}
        </p>
        <SegmentedControl
          size="sm"
          label="Zoom"
          value={zoom}
          onValueChange={(next) => {
            if (zoomProp === undefined) setZoomState(next)
            onZoomChange?.(next)
            setCursor(null)
          }}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
          ]}
        />
      </div>
      <div className="flex overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="w-36 shrink-0 border-r border-line">
          <div style={{ height: HEADER_H }} className="border-b border-line" />
          {resources.map((resource) => (
            <div key={resource.id} style={{ height: ROW_H }} className="flex flex-col justify-center border-b border-line px-3 last:border-b-0">
              <span className="truncate text-[12px] font-semibold text-ink">{resource.label}</span>
              {resource.detail && <span className="truncate text-[11px] font-medium text-ink-faint">{resource.detail}</span>}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width }}>
            <div aria-hidden="true" className="relative border-b border-line" style={{ height: HEADER_H }}>
              {days.map((day, d) =>
                zoom === 'day' ? (
                  hours.map((hour) => (
                    <span key={hour} className="absolute top-2 pl-1 text-[10px] font-semibold text-ink-faint" style={{ left: ((hour - dayStartHour) / span) * dayW }}>
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  ))
                ) : (
                  <span key={d} className="absolute top-2 pl-2 text-[11px] font-semibold text-ink-soft" style={{ left: d * dayW }}>
                    {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </span>
                ),
              )}
            </div>
            <div
              ref={bodyRef}
              role="group"
              aria-label={`${label}. Arrow keys move the cursor, Enter books the slot.`}
              aria-describedby={hintId}
              tabIndex={0}
              onKeyDown={onBodyKey}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onFocus={(event) => {
                let keyboard = false
                try {
                  keyboard = event.currentTarget.matches(':focus-visible')
                } catch {
                  keyboard = true
                }
                if (event.target === event.currentTarget && keyboard && !cursor) setCursor({ row: 0, minutes: 60 })
              }}
              onBlur={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setCursor(null)}
              className="relative cursor-crosshair touch-none select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus"
              style={{ height: resources.length * ROW_H }}
            >
              {resources.map((resource, row) => (
                <div key={resource.id} aria-hidden="true" className="absolute inset-x-0 border-b border-line" style={{ top: row * ROW_H, height: ROW_H }} />
              ))}
              {days.flatMap((_, d) =>
                hours.map((hour) => (
                  <div
                    key={`${d}-${hour}`}
                    aria-hidden="true"
                    className={cn('absolute inset-y-0 border-l', hour === dayStartHour ? 'border-line-strong' : 'border-line')}
                    style={{ left: d * dayW + ((hour - dayStartHour) / span) * dayW }}
                  />
                )),
              )}
              {cursor && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-[var(--radius-6)] border-2 border-dashed border-ink-faint"
                  style={{ left: (cursor.minutes / (span * 60)) * dayW, top: cursor.row * ROW_H + 4, width: dayW / span, height: ROW_H - 8 }}
                />
              )}
              {shown.map((booking) => {
                const row = resources.findIndex((entry) => entry.id === booking.resourceId)
                if (row < 0) return null
                const left = xOf(booking.start)
                const w = Math.max(10, xOf(booking.end) - left)
                const clash = bookings.some((other) => other.id !== booking.id && overlaps(booking, other)) || (drag?.draft.id === booking.id && shown.some((other) => overlaps(booking, other)))
                const dragging = drag?.draft.id === booking.id
                return (
                  <button
                    key={booking.id}
                    type="button"
                    data-booking={booking.id}
                    aria-label={`${describe(booking)}${clash ? ', conflicts with another booking' : ''}`}
                    aria-describedby={hintId}
                    onKeyDown={(event) => onBookingKey(event, booking)}
                    className={cn(
                      'group absolute flex cursor-grab flex-col items-start overflow-hidden rounded-[var(--radius-8)] border px-2 py-1 text-left active:cursor-grabbing',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      clash
                        ? 'border-danger bg-[color-mix(in_oklab,var(--color-danger)_14%,var(--color-surface))]'
                        : 'border-transparent bg-accent text-accent-ink',
                      dragging && 'opacity-80 shadow-[var(--shadow-float)]',
                    )}
                    style={{ left, width: w, top: row * ROW_H + 5, height: ROW_H - 10 }}
                  >
                    <span className="w-full truncate text-[12px] font-bold">{booking.title}</span>
                    <span className="w-full truncate text-[10px] font-semibold opacity-80">
                      {clock(booking.start)}–{clock(booking.end)}
                    </span>
                    <span data-edge="start" aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" />
                    <span data-edge="end" aria-hidden="true" className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" />
                  </button>
                )
              })}
              {nowX !== null && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-danger" style={{ left: nowX }}>
                  <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-danger" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <p id={hintId} className="text-[11px] font-medium text-ink-faint">
        Drag empty space to book. On a booking: arrows move it, Shift+arrows resize, Delete removes.
      </p>
      <PlotAnnouncer message={message} />
    </div>
  )
}
