'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { Label } from '../Label'
import { TimePicker } from '../TimePicker'

export interface TimeRangePickerValue {
  /** 24-hour HH:mm, or empty while unset. */
  start: string
  /** 24-hour HH:mm, or empty while unset. At or before start means the next day, when overnight is allowed. */
  end: string
}

export interface TimeRangePickerProps {
  /** Controlled range. */
  value?: TimeRangePickerValue
  /** Starting range when uncontrolled. */
  defaultValue?: TimeRangePickerValue
  /** Called with the whole range after either end changes. */
  onValueChange?: (value: TimeRangePickerValue) => void
  /** Names the pair as a group, such as “Opening hours”. */
  label: string
  /** Visible label of the first picker. */
  startLabel?: string
  /** Visible label of the second picker. */
  endLabel?: string
  /** Minutes between listed times. Also the shortest range. */
  step?: 15 | 30 | 60
  /** Let the end fall on the next day — a night shift, a maintenance window. */
  allowOvernight?: boolean
  /** Hide the duration read-out. */
  hideDuration?: boolean
  /** Blocks interaction and dims both pickers. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const DAY = 24 * 60
const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}
const toTime = (total: number) => {
  const wrapped = ((total % DAY) + DAY) % DAY
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}
const spell = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours && `${hours}h`, rest && `${rest}m`].filter(Boolean).join(' ') || '0m'
}

/**
 * Two TimePickers that know about each other.
 *
 * A start and an end chosen independently can describe a range that ends
 * before it begins, and the form finds out on submit. Here the end list only
 * offers times after the start, and moving the start carries the end with it,
 * keeping the length the person already chose — shifting a 90-minute slot from
 * 9:00 to 14:00 should not quietly turn it into a 30-minute one.
 *
 * With `allowOvernight`, any end is allowed and one at or before the start is
 * read as the next day: the field says “next day” and the duration counts past
 * midnight. The duration is announced politely whenever it changes, since the
 * end can move without being touched.
 */
export function TimeRangePicker({
  value,
  defaultValue = { start: '', end: '' },
  onValueChange,
  label,
  startLabel = 'Starts',
  endLabel = 'Ends',
  step = 30,
  allowOvernight = false,
  hideDuration = false,
  disabled = false,
  className,
}: TimeRangePickerProps) {
  const id = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const range = value ?? uncontrolled
  const last = DAY - step

  const commit = (next: TimeRangePickerValue) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }

  const length = (start: string, end: string) => {
    if (!start || !end) return null
    const raw = toMinutes(end) - toMinutes(start)
    return raw > 0 ? raw : allowOvernight ? raw + DAY : null
  }
  const duration = length(range.start, range.end)
  const overnight = duration !== null && toMinutes(range.end) <= toMinutes(range.start)

  const onStart = (start: string) => {
    const keep = length(range.start, range.end) ?? Math.max(step, 60)
    let end = toMinutes(start) + keep
    if (!allowOvernight) end = Math.min(end, last)
    commit({ start, end: toTime(end) })
  }

  return (
    <div role="group" aria-label={label} className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
          <Label htmlFor={`${id}-start`} disabled={disabled}>
            {startLabel}
          </Label>
          <TimePicker
            id={`${id}-start`}
            label={startLabel}
            value={range.start || undefined}
            onValueChange={onStart}
            step={step}
            max={allowOvernight ? undefined : toTime(last - step)}
            disabled={disabled}
          />
        </div>
        <span aria-hidden="true" className="flex h-10 items-center text-ink-faint">
          <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </span>
        <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
          <Label htmlFor={`${id}-end`} disabled={disabled}>
            {endLabel}
            {overnight && <span className="ml-1.5 font-bold text-ink">· next day</span>}
          </Label>
          <TimePicker
            id={`${id}-end`}
            label={overnight ? `${endLabel}, next day` : endLabel}
            value={range.end || undefined}
            onValueChange={(end) => commit({ ...range, end })}
            step={step}
            min={allowOvernight || !range.start ? undefined : toTime(toMinutes(range.start) + step)}
            disabled={disabled || (!allowOvernight && !range.start)}
          />
        </div>
      </div>
      {!hideDuration && (
        <p aria-live="polite" className="text-[12px] font-medium text-ink-faint tabular-nums">
          {duration === null ? (
            range.start && range.end ? 'The end has to come after the start.' : 'Choose a start and an end.'
          ) : (
            <>
              Duration <span className="font-bold text-ink">{spell(duration)}</span>
              {overnight && ', ending the next day'}
            </>
          )}
        </p>
      )}
    </div>
  )
}
