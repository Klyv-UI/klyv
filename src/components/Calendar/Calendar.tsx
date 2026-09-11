'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Local-time yyyy-mm-dd. Deliberately not toISOString, which shifts to UTC. */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1)
  // Monday-first, so Sunday (0) moves to the end of the previous week.
  const weekday = (first.getDay() + 6) % 7
  return new Date(year, month, 1 - weekday)
}

export interface CalendarProps {
  /** Selected date as an ISO yyyy-mm-dd string. */
  value?: string
  onValueChange?: (value: string) => void
  /** Range endpoints, used by DateRangePicker to shade the span between them. */
  rangeStart?: string
  rangeEnd?: string
  /** Earliest and latest selectable dates, as ISO strings. */
  min?: string
  max?: string
  /** Accessible name for the grid. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A month grid with the full date keyboard model: arrows move by day and week,
 * Home and End jump to the ends of the week, PageUp and PageDown change month.
 *
 * The grid is a real table with column headers, and each day carries its whole
 * date as an accessible name — so a screen reader announces "Tuesday 14 October
 * 2026" rather than "14".
 */
export function Calendar({
  value,
  onValueChange,
  rangeStart,
  rangeEnd,
  min,
  max,
  label = 'Choose a date',
  className,
}: CalendarProps) {
  const initial = value ? fromISODate(value) : new Date()
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() })
  const [focusedDate, setFocusedDate] = useState(toISODate(initial))

  const days = useMemo(() => {
    const start = startOfMonthGrid(view.year, view.month)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [view])

  const today = toISODate(new Date())
  const isDisabled = (iso: string) => Boolean((min && iso < min) || (max && iso > max))

  const shiftView = (delta: number) => {
    setView((previous) => {
      const next = new Date(previous.year, previous.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const moveFocus = (event: KeyboardEvent, deltaDays: number) => {
    event.preventDefault()
    const next = fromISODate(focusedDate)
    next.setDate(next.getDate() + deltaDays)
    setFocusedDate(toISODate(next))
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const weekday = (fromISODate(focusedDate).getDay() + 6) % 7
    if (event.key === 'ArrowRight') moveFocus(event, 1)
    else if (event.key === 'ArrowLeft') moveFocus(event, -1)
    else if (event.key === 'ArrowDown') moveFocus(event, 7)
    else if (event.key === 'ArrowUp') moveFocus(event, -7)
    else if (event.key === 'Home') moveFocus(event, -weekday)
    else if (event.key === 'End') moveFocus(event, 6 - weekday)
    else if (event.key === 'PageUp') {
      event.preventDefault()
      shiftView(-1)
    } else if (event.key === 'PageDown') {
      event.preventDefault()
      shiftView(1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!isDisabled(focusedDate)) onValueChange?.(focusedDate)
    }
  }

  const inRange = (iso: string) => Boolean(rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd)

  return (
    <div className={cn('w-[280px] select-none', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <IconButton
          icon={ChevronLeftIcon}
          label="Previous month"
          size="sm"
          onClick={() => shiftView(-1)}
        />
        <Text size="body" aria-live="polite">
          {MONTHS[view.month]} {view.year}
        </Text>
        <IconButton
          icon={ChevronRightIcon}
          label="Next month"
          size="sm"
          onClick={() => shiftView(1)}
        />
      </div>

      <table role="grid" aria-label={label} className="w-full border-collapse">
        <thead>
          <tr>
            {WEEKDAYS.map((day) => (
              <th key={day} scope="col" className="pb-1">
                <Text as="span" size="caption" weight="bold" tone="faint">
                  {day}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody onKeyDown={onKeyDown}>
          {Array.from({ length: 6 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const iso = toISODate(date)
                const outside = date.getMonth() !== view.month
                const selected = iso === value || iso === rangeStart || iso === rangeEnd
                const disabled = isDisabled(iso)
                return (
                  // In the grid pattern, selection belongs to the cell and not
                  // to the control inside it — aria-selected is not a valid
                  // attribute on a button, and axe flagged every day at once.
                  <td
                    key={iso}
                    role="gridcell"
                    aria-selected={selected}
                    className="p-0.5 text-center"
                  >
                    <button
                      type="button"
                      tabIndex={iso === focusedDate ? 0 : -1}
                      aria-current={iso === today ? 'date' : undefined}
                      disabled={disabled}
                      onClick={() => {
                        setFocusedDate(iso)
                        onValueChange?.(iso)
                      }}
                      onFocus={() => setFocusedDate(iso)}
                      className={cn(
                        'tabular relative flex size-9 items-center justify-center rounded-full text-[12px] transition-colors',
                        'disabled:pointer-events-none disabled:opacity-30',
                        selected
                          ? 'bg-accent font-bold text-accent-ink'
                          : inRange(iso)
                            ? 'bg-accent-soft/60 font-semibold text-ink'
                            : outside
                              ? 'font-medium text-ink-faint hover:bg-surface-muted'
                              : 'font-semibold text-ink hover:bg-surface-muted',
                      )}
                    >
                      <span aria-hidden="true">{date.getDate()}</span>
                      <VisuallyHidden>
                        {date.toLocaleDateString('en-GB', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        {iso === today ? ', today' : ''}
                      </VisuallyHidden>
                      {iso === today && !selected && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 size-1 rounded-full bg-accent-strong"
                        />
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
