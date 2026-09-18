'use client'

import { useId, useState } from 'react'
import { cn } from '../../lib/cn'
import { DatePicker } from '../DatePicker'
import { NumberInput } from '../NumberInput'
import { Radio } from '../Radio'
import { Select } from '../Select'

export type RecurrenceEditorFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceEditorValue {
  frequency: RecurrenceEditorFrequency
  /** Every n days, weeks, months or years. */
  interval: number
  /** Weekly days, 0 for Sunday to 6 for Saturday. */
  weekdays: number[]
  /** Monthly by a date (the 14th) or by a weekday in the month (the second Tuesday). */
  monthlyBy: 'date' | 'weekday'
  /** Day of the month for monthly-by-date and yearly, 1 to 31. */
  monthDay: number
  /** Which weekday of the month: 1 to 4, or -1 for the last. */
  nth: number
  /** Weekday for monthly-by-weekday, 0 to 6. */
  nthWeekday: number
  /** Month for yearly, 1 to 12. */
  month: number
  /** When the series stops. */
  ends: 'never' | 'on' | 'after'
  /** Last possible date, yyyy-mm-dd, when ends is on. */
  until?: string
  /** Number of occurrences, when ends is after. */
  count: number
}

export interface RecurrenceEditorProps {
  /** Controlled rule. */
  value?: RecurrenceEditorValue
  /** Starting rule when uncontrolled. Missing fields take the defaults. */
  defaultValue?: Partial<RecurrenceEditorValue>
  /** Called with the rule, its sentence and its RRULE after every change. */
  onValueChange?: (value: RecurrenceEditorValue, details: { summary: string; rrule: string }) => void
  /** Names the group. */
  label?: string
  /** Show the RRULE string under the summary. */
  showRRule?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ORDINALS: Record<string, string> = { '1': 'first', '2': 'second', '3': 'third', '4': 'fourth', '-1': 'last' }
const UNITS: Record<RecurrenceEditorFrequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
}
const DEFAULTS: RecurrenceEditorValue = {
  frequency: 'weekly', interval: 1, weekdays: [1], monthlyBy: 'date', monthDay: 1, nth: 1, nthWeekday: 1, month: 1, ends: 'never', count: 10,
}

/** Monday first, the way the toggles are laid out. */
const weekOrder = (days: number[]) => [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
const list = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`)

function summarise(rule: RecurrenceEditorValue): string {
  const [one, many] = UNITS[rule.frequency]
  let text = rule.interval === 1 ? `Every ${one}` : `Every ${rule.interval} ${many}`
  if (rule.frequency === 'weekly') text += ` on ${list(weekOrder(rule.weekdays).map((day) => DAYS[day].slice(0, 3)))}`
  if (rule.frequency === 'monthly') {
    text += rule.monthlyBy === 'date' ? ` on day ${rule.monthDay}` : ` on the ${ORDINALS[rule.nth]} ${DAYS[rule.nthWeekday]}`
  }
  if (rule.frequency === 'yearly') text += ` on ${rule.monthDay} ${MONTHS[rule.month - 1]}`
  if (rule.ends === 'after') text += rule.count === 1 ? ', once' : `, ${rule.count} times`
  if (rule.ends === 'on' && rule.until) {
    const [year, month, day] = rule.until.split('-').map(Number)
    text += `, until ${day} ${MONTHS[month - 1].slice(0, 3)} ${year}`
  }
  return text
}

function toRRule(rule: RecurrenceEditorValue): string {
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`]
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`)
  if (rule.frequency === 'weekly') parts.push(`BYDAY=${weekOrder(rule.weekdays).map((day) => CODES[day]).join(',')}`)
  if (rule.frequency === 'monthly') {
    parts.push(rule.monthlyBy === 'date' ? `BYMONTHDAY=${rule.monthDay}` : `BYDAY=${rule.nth}${CODES[rule.nthWeekday]}`)
  }
  if (rule.frequency === 'yearly') parts.push(`BYMONTH=${rule.month}`, `BYMONTHDAY=${rule.monthDay}`)
  if (rule.ends === 'after') parts.push(`COUNT=${rule.count}`)
  if (rule.ends === 'on' && rule.until) parts.push(`UNTIL=${rule.until.replace(/-/g, '')}`)
  return `RRULE:${parts.join(';')}`
}

/**
 * The “Repeats” section of an event form, with the rule read back as a sentence.
 *
 * Recurrence is where calendar forms lose people: five controls whose meaning
 * depends on each other, and no way to tell what was built until the calendar
 * fills up. So the editor always ends in a plain sentence — “Every 2 weeks on
 * Mon and Thu, 10 times” — announced as it changes, and hands the caller the
 * same rule as an RFC 5545 RRULE for whatever stores or expands it.
 *
 * Only the controls the frequency needs are shown. Weekly always keeps at least
 * one day, because a weekly rule with no days means nothing. Monthly offers
 * both readings people mean, “on the 14th” and “on the second Tuesday”, as a
 * radio pair rather than a hidden mode.
 */
export function RecurrenceEditor({ value, defaultValue, onValueChange, label = 'Repeats', showRRule = false, className }: RecurrenceEditorProps) {
  const id = useId()
  const [uncontrolled, setUncontrolled] = useState<RecurrenceEditorValue>(() => ({ ...DEFAULTS, ...defaultValue }))
  const rule = value ?? uncontrolled
  const set = (patch: Partial<RecurrenceEditorValue>) => {
    const next = { ...rule, ...patch }
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next, { summary: summarise(next), rrule: toRRule(next) })
  }
  const many = UNITS[rule.frequency][1]
  const row = 'flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-soft'

  const toggleDay = (day: number) => {
    const on = rule.weekdays.includes(day)
    if (on && rule.weekdays.length === 1) return
    set({ weekdays: on ? rule.weekdays.filter((d) => d !== day) : weekOrder([...rule.weekdays, day]) })
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={cn('flex flex-col gap-4', className)}>
      <span id={`${id}-label`} className="text-[12px] font-semibold text-ink-soft">
        {label}
      </span>
      <div className={row}>
        <span aria-hidden="true">Every</span>
        <NumberInput aria-label={`Repeat every how many ${many}`} value={rule.interval} onValueChange={(interval) => set({ interval })} min={1} max={99} steppers={false} inputSize="sm" containerClassName="w-16" />
        <Select
          label="Frequency"
          value={rule.frequency}
          onValueChange={(frequency) => set({ frequency })}
          options={(Object.keys(UNITS) as RecurrenceEditorFrequency[]).map((key) => ({ value: key, label: rule.interval === 1 ? UNITS[key][0] : UNITS[key][1] }))}
          size="sm"
          align="start"
        />
      </div>

      {rule.frequency === 'weekly' && (
        <div role="group" aria-label="On these days" className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const on = rule.weekdays.includes(day)
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={DAYS[day]}
                onClick={() => toggleDay(day)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-full border text-[12px] font-bold transition-colors',
                  on ? 'border-accent-strong bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {DAYS[day].slice(0, 2)}
              </button>
            )
          })}
        </div>
      )}

      {rule.frequency === 'monthly' && (
        <div role="radiogroup" aria-label="Day of the month" className="flex flex-col gap-2.5">
          <div className={row}>
            <label className="flex items-center gap-2">
              <Radio name={`${id}-monthly`} checked={rule.monthlyBy === 'date'} onChange={() => set({ monthlyBy: 'date' })} dotSize="sm" />
              On day
            </label>
            <NumberInput aria-label="Day of the month" value={rule.monthDay} onValueChange={(monthDay) => set({ monthDay, monthlyBy: 'date' })} min={1} max={31} steppers={false} inputSize="sm" containerClassName="w-16" />
          </div>
          <div className={row}>
            <label className="flex items-center gap-2">
              <Radio name={`${id}-monthly`} checked={rule.monthlyBy === 'weekday'} onChange={() => set({ monthlyBy: 'weekday' })} dotSize="sm" />
              On the
            </label>
            <Select label="Which week" size="sm" align="start" value={String(rule.nth)} onValueChange={(nth) => set({ nth: Number(nth), monthlyBy: 'weekday' })} options={Object.entries(ORDINALS).map(([key, word]) => ({ value: key, label: word }))} />
            <Select label="Weekday" size="sm" align="start" value={String(rule.nthWeekday)} onValueChange={(day) => set({ nthWeekday: Number(day), monthlyBy: 'weekday' })} options={DAYS.map((day, index) => ({ value: String(index), label: day }))} />
          </div>
        </div>
      )}

      {rule.frequency === 'yearly' && (
        <div className={row}>
          <span aria-hidden="true">On</span>
          <NumberInput aria-label="Day" value={rule.monthDay} onValueChange={(monthDay) => set({ monthDay })} min={1} max={31} steppers={false} inputSize="sm" containerClassName="w-16" />
          <Select label="Month" size="sm" align="start" value={String(rule.month)} onValueChange={(month) => set({ month: Number(month) })} options={MONTHS.map((month, index) => ({ value: String(index + 1), label: month }))} />
        </div>
      )}

      <div role="radiogroup" aria-labelledby={`${id}-ends`} className="flex flex-col gap-2.5">
        <span id={`${id}-ends`} className="text-[12px] font-semibold text-ink-soft">
          Ends
        </span>
        <label className={row}>
          <Radio name={`${id}-ends`} checked={rule.ends === 'never'} onChange={() => set({ ends: 'never' })} dotSize="sm" />
          Never
        </label>
        <div className={row}>
          <label className="flex items-center gap-2">
            <Radio name={`${id}-ends`} checked={rule.ends === 'on'} onChange={() => set({ ends: 'on' })} dotSize="sm" />
            On
          </label>
          <DatePicker label="End date" value={rule.until} onValueChange={(until) => set({ until, ends: 'on' })} className="w-[170px]" />
        </div>
        <div className={row}>
          <label className="flex items-center gap-2">
            <Radio name={`${id}-ends`} checked={rule.ends === 'after'} onChange={() => set({ ends: 'after' })} dotSize="sm" />
            After
          </label>
          <NumberInput aria-label="Number of occurrences" value={rule.count} onValueChange={(count) => set({ count, ends: 'after' })} min={1} max={999} steppers={false} inputSize="sm" containerClassName="w-20" />
          <span aria-hidden="true">{rule.count === 1 ? 'occurrence' : 'occurrences'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-[var(--radius-glyph)] bg-surface-sunken px-3 py-2.5">
        <p aria-live="polite" className="text-[13px] font-bold text-ink">
          {summarise(rule)}
        </p>
        {showRRule && <code className="break-all font-mono text-[11px] text-ink-faint">{toRRule(rule)}</code>}
      </div>
    </div>
  )
}
