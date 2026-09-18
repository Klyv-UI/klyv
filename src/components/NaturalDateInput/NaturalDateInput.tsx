'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Calendar, toISODate } from '../Calendar'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { Popover } from '../Popover'

export interface NaturalDateInputReading {
  /** What the phrase most likely means, or null when it could not be read. */
  date: Date | null
  /** Whether the phrase named a time of day. */
  hasTime: boolean
  /** Other readings of the same words, each with the reason it differs. */
  alternatives: { date: Date; note: string }[]
}

export interface NaturalDateInputProps {
  /** Controlled moment. null is an empty field. */
  value?: Date | null
  /** Starting moment when uncontrolled. */
  defaultValue?: Date | null
  /** Called when a reading is committed — Enter, leaving the field, a calendar pick, or a suggestion. */
  onValueChange?: (value: Date | null) => void
  /** The “now” that phrases are read against. Defaults to the current time. */
  referenceDate?: Date
  /** Read 03/04 as 3 April (true) or March 4 (false). The other reading is still offered. */
  dayFirst?: boolean
  /** Accessible name. Pair with a Field for a visible one. */
  label: string
  placeholder?: string
  /** Marks the field invalid from outside. */
  invalid?: boolean
  disabled?: boolean
  /** Overrides the generated id. Field supplies one. */
  id?: string
  /** Extra descriptions, such as a Field hint. */
  'aria-describedby'?: string
  /** Merged last, so it wins. */
  className?: string
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
const Title = (word: string) => word[0].toUpperCase() + word.slice(1)

const day = (d: Date, delta = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta)
const byPrefix = (list: string[], word: string) => (word.length >= 3 ? list.findIndex((name) => name.startsWith(word)) : -1)
const valid = (y: number, m: number, d: number) => m >= 0 && m < 12 && d >= 1 && d <= new Date(y, m + 1, 0).getDate()

/** Reads a phrase such as “next fri 3pm”, “in 2 weeks” or “dec 25” against a reference moment. */
export function parseNaturalDate(input: string, reference: Date, dayFirst = true): NaturalDateInputReading {
  const none: NaturalDateInputReading = { date: null, hasTime: false, alternatives: [] }
  let s = input.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ')
  if (!s) return none

  // The time of day comes off first, so what is left is only the date.
  const clock: { time: [number, number] | null; alternative: [number, number] | null } = { time: null, alternative: null }
  const take = (pattern: RegExp, read: (m: RegExpExecArray) => [number, number] | null) => {
    const m = clock.time ? null : pattern.exec(s)
    const t = m && read(m)
    if (!m || !t) return
    clock.time = t
    s = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\bat\s*$/, '').trim()
  }
  take(/\b(noon|midday|midnight)\b/, (m) => [m[1] === 'midnight' ? 0 : 12, 0])
  take(/(?:\bat\s*)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/, (m) => {
    const h = Number(m[1])
    if (h < 1 || h > 12 || Number(m[2] ?? 0) > 59) return null
    return [(h % 12) + (m[3] === 'pm' ? 12 : 0), Number(m[2] ?? 0)]
  })
  take(/(?:\bat\s*)?(?<![\d-])\b(\d{1,2}):(\d{2})\b/, (m) => (Number(m[1]) < 24 && Number(m[2]) < 60 ? [Number(m[1]), Number(m[2])] : null))
  take(/\bat\s+(\d{1,2})\b/, (m) => {
    const h = Number(m[1])
    if (h > 23) return null
    if (h >= 1 && h <= 11) clock.alternative = [h + 12, 0]
    return [h, 0]
  })

  let time = clock.time
  const today = day(reference)
  let date: Date | null = null
  let keepClock = false
  const alternatives: { date: Date; note: string }[] = []
  let m: RegExpExecArray | null

  if (s === '' || s === 'today') date = today
  else if (s === 'now') {
    date = new Date(reference)
    keepClock = true
  } else if (s === 'tonight') {
    date = today
    time ??= [20, 0]
  } else if (s === 'tomorrow' || s === 'tmr' || s === 'tmrw') date = day(today, 1)
  else if (s === 'yesterday') date = day(today, -1)
  else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:t(\d{1,2}):(\d{2}))?$/.exec(s))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
    if (valid(y, mo, d)) date = new Date(y, mo, d)
    if (m[4]) time = [Number(m[4]), Number(m[5])]
  } else if ((m = /^(?:in )?(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (min(?:ute)?s?|hours?|hrs?|days?|weeks?|fortnights?|months?|years?)( ago| from now| later)?$/.exec(s)) && (s.startsWith('in ') || m[3])) {
    const n = (NUMBERS[m[1]] ?? Number(m[1])) * (m[3] === ' ago' ? -1 : 1)
    const unit = m[2]
    date = new Date(reference)
    if (unit.startsWith('min') || unit.startsWith('h')) {
      date.setMinutes(date.getMinutes() + n * (unit.startsWith('min') ? 1 : 60))
      keepClock = true
    } else {
      date = day(today)
      if (unit.startsWith('day')) date.setDate(date.getDate() + n)
      if (unit.startsWith('week')) date.setDate(date.getDate() + 7 * n)
      if (unit.startsWith('fortnight')) date.setDate(date.getDate() + 14 * n)
      if (unit.startsWith('month')) date = new Date(date.getFullYear(), date.getMonth() + n, Math.min(date.getDate(), new Date(date.getFullYear(), date.getMonth() + n + 1, 0).getDate()))
      if (unit.startsWith('year')) date.setFullYear(date.getFullYear() + n)
    }
  } else if ((m = /^(?:(next|this|coming|last) )?([a-z]+)$/.exec(s)) && byPrefix(WEEKDAYS, m[2]) >= 0) {
    const target = byPrefix(WEEKDAYS, m[2])
    const now = today.getDay()
    if (m[1] === 'last') date = day(today, -(((now - target + 6) % 7) + 1))
    else {
      const ahead = (target - now + 7) % 7
      const upcoming = m[1] === 'next' || (m[1] === 'coming' && ahead === 0) ? ahead || 7 : ahead
      date = day(today, upcoming)
      // “next Friday” said on a Tuesday means this week’s Friday to some people, the week after to others.
      const endOfWeek = (7 - now) % 7
      if (m[1] === 'next' && upcoming <= endOfWeek) alternatives.push({ date: day(today, upcoming + 7), note: 'the one in the following week' })
      if (!m[1] && ahead === 0) alternatives.push({ date: day(today, 7), note: 'a week from today' })
    }
  } else if ((m = /^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+)(?: (\d{4}))?$/.exec(s) ?? /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(s))) {
    const [dayText, monthText] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]]
    const month = byPrefix(MONTHS, monthText)
    const d = Number(dayText)
    const year = m[3] ? Number(m[3]) : today.getFullYear()
    if (month >= 0 && valid(year, month, d)) {
      date = new Date(year, month, d)
      if (!m[3] && date < today) {
        alternatives.push({ date, note: 'earlier this year' })
        date = new Date(year + 1, month, d)
      }
    }
  } else if ((m = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(s))) {
    const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear()
    const [a, b] = [Number(m[1]), Number(m[2])]
    const readings = [dayFirst ? [b - 1, a] : [a - 1, b], dayFirst ? [a - 1, b] : [b - 1, a]].filter(([mo, d]) => valid(year, mo, d))
    if (readings[0]) date = new Date(year, readings[0][0], readings[0][1])
    if (readings[1] && a !== b) alternatives.push({ date: new Date(year, readings[1][0], readings[1][1]), note: dayFirst ? 'month first' : 'day first' })
  } else if ((m = /^(start|beginning|end) of (?:the )?(next |this |last )?(week|month|year)$/.exec(s))) {
    const shift = m[2] === 'next ' ? 1 : m[2] === 'last ' ? -1 : 0
    const end = m[1] === 'end'
    if (m[3] === 'week') {
      const monday = day(today, -((today.getDay() + 6) % 7) + shift * 7)
      date = day(monday, end ? 6 : 0)
      if (end) alternatives.push({ date: day(monday, 4), note: 'the last working day' })
    } else if (m[3] === 'month') date = new Date(today.getFullYear(), today.getMonth() + shift + (end ? 1 : 0), end ? 0 : 1)
    else date = new Date(today.getFullYear() + shift, end ? 11 : 0, end ? 31 : 1)
  } else if ((m = /^next (week|month|year)$/.exec(s))) {
    if (m[1] === 'week') date = day(today, 7 - ((today.getDay() + 6) % 7))
    else if (m[1] === 'month') date = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    else date = new Date(today.getFullYear() + 1, 0, 1)
  } else if (s === 'this weekend' || s === 'weekend') date = day(today, (6 - today.getDay() + 7) % 7)

  if (!date) return none
  const at = (d: Date, t: [number, number] | null) => (t ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), t[0], t[1]) : d)
  const primary = keepClock ? date : at(date, time)
  const reading: NaturalDateInputReading = {
    date: primary,
    hasTime: keepClock || time !== null,
    alternatives: alternatives.map((alt) => ({ ...alt, date: at(alt.date, time) })),
  }
  if (clock.alternative) reading.alternatives.push({ date: at(date, clock.alternative), note: 'in the evening' })
  // A bare time that has already passed today probably means tomorrow.
  if (time && (s === '' || s === 'today') && primary < reference) reading.alternatives.push({ date: at(day(today, 1), time), note: 'tomorrow' })
  return reading
}

/** “Friday, 25 September, 15:00”, with the year only when it is not the reference year. */
export function formatNaturalDate(date: Date, hasTime: boolean, reference: Date): string {
  const year = date.getFullYear() === reference.getFullYear() ? '' : ` ${date.getFullYear()}`
  const clock = hasTime ? `, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : ''
  return `${Title(WEEKDAYS[date.getDay()])}, ${date.getDate()} ${Title(MONTHS[date.getMonth()])}${year}${clock}`
}

const CalendarIcon: IconComponent = ({ size = 16 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
)

/**
 * A date field that takes words — “tomorrow”, “next fri 3pm”, “in 2 weeks”,
 * “end of month” — for the scheduling moments where people already think in
 * phrases and a calendar grid is three clicks too many.
 *
 * It never guesses silently. Whatever you type is read back in full on the line
 * beneath while you type, so “next fri” shows which Friday before it is
 * committed, and when the words have more than one fair reading the others are
 * listed as one-click corrections. The calendar is still there beside the
 * field, for anyone who would rather point.
 */
export function NaturalDateInput({
  value,
  defaultValue = null,
  onValueChange,
  referenceDate,
  dayFirst = true,
  label,
  placeholder = 'Try “next fri 3pm” or “in 2 weeks”',
  invalid = false,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: NaturalDateInputProps) {
  const uid = useId()
  const [now] = useState(() => new Date())
  const reference = referenceDate ?? now
  const [uncontrolled, setUncontrolled] = useState<Date | null>(defaultValue)
  const current = value !== undefined ? value : uncontrolled
  const [hasTime, setHasTime] = useState(() => Boolean(current && (current.getHours() || current.getMinutes())))
  const [text, setText] = useState(() => (current ? formatNaturalDate(current, hasTime, reference) : ''))
  const [attempted, setAttempted] = useState(false)
  const [open, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const committed = useRef(current?.getTime() ?? null)

  // A value set from outside replaces the words with its own reading.
  useEffect(() => {
    const time = current?.getTime() ?? null
    if (time === committed.current) return
    committed.current = time
    setText(current ? formatNaturalDate(current, hasTime, reference) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.getTime()])

  const reading = useMemo(() => parseNaturalDate(text, reference, dayFirst), [text, reference, dayFirst])

  const commit = (date: Date | null, withTime: boolean, rewrite = false) => {
    committed.current = date?.getTime() ?? null
    setHasTime(withTime)
    if (rewrite) setText(date ? formatNaturalDate(date, withTime, reference) : '')
    if (value === undefined) setUncontrolled(date)
    onValueChange?.(date)
    setAnnouncement(date ? `Set to ${formatNaturalDate(date, withTime, reference)}.` : 'Cleared.')
  }

  const commitText = () => {
    setAttempted(true)
    if (!text.trim()) return current !== null && commit(null, false)
    if (reading.date && reading.date.getTime() !== current?.getTime()) commit(reading.date, reading.hasTime)
  }

  const unreadable = Boolean(text.trim()) && !reading.date
  const showInvalid = invalid || (unreadable && attempted)
  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <Input
          id={id ?? `${uid}-input`}
          aria-label={label}
          aria-describedby={[describedBy, `${uid}-reading`].filter(Boolean).join(' ')}
          value={text}
          placeholder={placeholder}
          invalid={showInvalid}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            setText(event.target.value)
            setAttempted(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commitText()
          }}
          onBlur={commitText}
          containerClassName="min-w-0 flex-1"
        />
        <Popover
          open={open}
          onOpenChange={(next) => !disabled && setOpen(next)}
          placement="bottom"
          align="end"
          label={`${label} calendar`}
          className="p-3"
          initialFocus='[role="grid"] button[tabindex="0"]'
          trigger={<IconButton icon={CalendarIcon} label={`Choose ${label.toLowerCase()} from a calendar`} tone="plain" size="md" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} />}
        >
          <Calendar
            label={label}
            value={toISODate(current ?? reading.date ?? reference)}
            onValueChange={(iso) => {
              const [y, m, d] = iso.split('-').map(Number)
              const base = current ?? reading.date
              const withTime = Boolean(base && hasTime)
              commit(new Date(y, m - 1, d, withTime ? base!.getHours() : 0, withTime ? base!.getMinutes() : 0), withTime, true)
              setOpen(false)
            }}
          />
        </Popover>
      </div>
      <p id={`${uid}-reading`} className={cn('min-h-[18px] px-1 text-[12px] font-medium', showInvalid ? 'text-danger' : 'text-ink-soft')}>
        {reading.date ? (
          <>
            <span className="sr-only">Reads as </span>
            <span aria-hidden="true" className="text-ink-faint">
              →{' '}
            </span>
            <span className="font-bold text-ink">{formatNaturalDate(reading.date, reading.hasTime, reference)}</span>
          </>
        ) : unreadable ? (
          'Not a date I can read. Try “tomorrow 9am”, “dec 25” or “in 3 days”, or use the calendar.'
        ) : null}
      </p>
      {reading.alternatives.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[12px] font-medium text-ink-faint">Or did you mean</span>
          {reading.alternatives.map((alt) => {
            const phrase = formatNaturalDate(alt.date, reading.hasTime, reference)
            return (
              <button
                key={`${alt.note}-${alt.date.getTime()}`}
                type="button"
                onClick={() => commit(alt.date, reading.hasTime, true)}
                className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[12px] font-semibold text-ink transition-colors hover:border-line-strong"
              >
                {phrase} <span className="font-medium text-ink-faint">({alt.note})</span>
              </button>
            )
          })}
        </div>
      )}
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
