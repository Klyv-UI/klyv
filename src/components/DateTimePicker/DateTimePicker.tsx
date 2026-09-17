'use client'

import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Calendar, toISODate } from '../Calendar'
import { Input } from '../Input'
import { Popover } from '../Popover'
import { Text } from '../Text'
import { TimePicker } from '../TimePicker'

export interface DateTimePickerProps {
  /** Controlled value. `null` is an empty field. */
  value?: Date | null
  /** Starting value when uncontrolled. */
  defaultValue?: Date | null
  /** Called with the new moment, or `null` when the field is cleared. */
  onValueChange?: (value: Date | null) => void
  /** Accessible name for the field and the picker panel. Pair with a Field for a visible label. */
  label: string
  /** Earliest selectable moment. */
  min?: Date
  /** Latest selectable moment. */
  max?: Date
  /** Minutes between the times offered in the list. Any minute can still be typed. */
  step?: 15 | 30 | 60
  /** The zone the value is read in — "Europe/London", "GMT+1". Shown beside the field so nobody guesses. */
  timeZoneLabel?: string
  /** Shown while the field is empty. */
  placeholder?: string
  /** Marks the field as failing validation. Pair it with a message. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Goes on the text input, so a Field label points at it. */
  id?: string
  /** Forwarded from Field. */
  'aria-describedby'?: string
  /** Merged last, so it wins. */
  className?: string
}

const pad = (value: number) => String(value).padStart(2, '0')
const timeOf = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const format = (date: Date | null | undefined) => (date ? `${toISODate(date)} ${timeOf(date)}` : '')

/** "2026-09-17 14:30", with a T or a space. Anything else is refused rather than guessed at. */
function parse(text: string): Date | null | undefined {
  const trimmed = text.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?$/.exec(trimmed)
  if (!match) return undefined
  const [, y, mo, d, h = '0', mi = '0'] = match
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  // Date rolls 31 February into March; a typed date that rolled is a typo.
  if (date.getMonth() !== Number(mo) - 1 || Number(h) > 23) return undefined
  return date
}

/**
 * One field for a date and a time, typed or picked.
 *
 * DatePicker is read-only because most dates are found faster on a grid. A
 * date *with* a time is different: people paste them from tickets and calendar
 * invites, so the field takes typed text in one unambiguous shape and the
 * button beside it opens the same Calendar and TimePicker used everywhere else.
 * The value is a `Date`, not a pair of strings the caller has to stitch back
 * together, and the zone it is read in sits beside the field — a time without
 * one is the usual cause of a meeting booked an hour out.
 */
export function DateTimePicker({
  value,
  defaultValue = null,
  onValueChange,
  label,
  min,
  max,
  step = 30,
  timeZoneLabel,
  placeholder = 'YYYY-MM-DD HH:mm',
  invalid = false,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: DateTimePickerProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const current = value === undefined ? uncontrolled : value
  const [draft, setDraft] = useState(format(current))
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  // A new value from outside replaces whatever was half-typed.
  const stamp = current?.getTime() ?? null
  useEffect(() => {
    setDraft(format(current))
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp])

  const commit = (next: Date | null) => {
    if (next && ((min && next < min) || (max && next > max))) {
      setError(`Choose a time between ${format(min) || 'any time'} and ${format(max) || 'any time'}.`)
      return
    }
    setError('')
    setDraft(format(next))
    if (value === undefined) setUncontrolled(next)
    if ((next?.getTime() ?? null) !== stamp) onValueChange?.(next)
  }

  const commitDraft = () => {
    const parsed = parse(draft)
    if (parsed === undefined) setError('Type the date and time as YYYY-MM-DD HH:mm.')
    else commit(parsed)
  }

  const day = current ? toISODate(current) : undefined
  const time = current ? timeOf(current) : undefined
  // The time list is only narrowed on the days the limits fall on.
  const minTime = min && day === toISODate(min) ? timeOf(min) : undefined
  const maxTime = max && day === toISODate(max) ? timeOf(max) : undefined

  const pickDay = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    const base = current ?? new Date(y, m - 1, d, 9, 0)
    let next = new Date(y, m - 1, d, base.getHours(), base.getMinutes())
    if (min && next < min) next = new Date(min)
    if (max && next > max) next = new Date(max)
    commit(next)
  }

  const pickTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const base = current ?? new Date()
    commit(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m))
  }

  const errorId = `${uid}-error`
  const zoneId = `${uid}-zone`
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitDraft()
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <div className="relative">
        <Input
          id={id}
          aria-label={id ? undefined : label}
          aria-describedby={[describedBy, timeZoneLabel && zoneId, error && errorId].filter(Boolean).join(' ') || undefined}
          value={draft}
          placeholder={placeholder}
          invalid={invalid || Boolean(error)}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={onKeyDown}
          className="tabular pr-[88px]"
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {timeZoneLabel && (
            <span id={zoneId} className="max-w-[80px] truncate text-[11px] font-semibold text-ink-faint">
              <span className="sr-only">Time zone </span>
              {timeZoneLabel}
            </span>
          )}
          <Popover
            open={open}
            onOpenChange={(next) => !disabled && setOpen(next)}
            placement="bottom"
            align="end"
            label={label}
            className="flex flex-col gap-3 p-3"
            initialFocus='[role="grid"] button[tabindex="0"]'
            trigger={
              <button
                type="button"
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`Choose ${label.toLowerCase()}`}
                className="flex size-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
              >
                <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <rect x="2" y="3" width="12" height="11" rx="2" />
                  <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                </svg>
              </button>
            }
          >
            <Calendar
              value={day}
              min={min && toISODate(min)}
              max={max && toISODate(max)}
              label={`${label}, date`}
              onValueChange={pickDay}
            />
            <div className="flex items-center gap-2">
              <TimePicker
                value={time}
                onValueChange={pickTime}
                label={`${label}, time`}
                step={step}
                min={minTime}
                max={maxTime}
                disabled={!current}
                placeholder="Time"
                className="w-[120px]"
              />
              {timeZoneLabel && (
                <Text size="caption" tone="faint" weight="semibold" className="min-w-0 flex-1 truncate">
                  {timeZoneLabel}
                </Text>
              )}
              <Button size="sm" className="ml-auto" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </Popover>
        </div>
      </div>
      {error && (
        <Text id={errorId} size="caption" tone="danger" weight="semibold" role="alert">
          {error}
        </Text>
      )}
    </div>
  )
}
