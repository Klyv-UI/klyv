'use client'

import { useId, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Field } from '../Field'
import { Input } from '../Input'
import { Select } from '../Select'
import { CRON_SPECS, MACROS, describeCron, isValidZone, nextRuns, parseCron, type CronEditorFieldName } from './cron'

export interface CronEditorProps {
  /** Visible label for the expression field. */
  label?: string
  /** Controlled expression. */
  value?: string
  /** Starting expression when uncontrolled. */
  defaultValue?: string
  /** Called with the expression after every edit, valid or not. */
  onValueChange?: (value: string) => void
  /** Controlled IANA time zone the run times are computed in. */
  timeZone?: string
  /** Starting zone when uncontrolled. Defaults to the browser’s zone. */
  defaultTimeZone?: string
  /** Called when the zone picker changes. */
  onTimeZoneChange?: (zone: string) => void
  /** Zones offered in the picker. The current zone is always included. */
  timeZones?: string[]
  /** How many upcoming runs to list. */
  count?: number
  /** Count runs from this moment instead of now — for tests and fixed demos. */
  from?: Date
  /** Locale for the run times. Defaults to the browser’s. */
  locale?: string
  /** Merged last, so it wins. */
  className?: string
}

const ZONES = ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney']

const HELPERS: Record<CronEditorFieldName, [string, string][]> = {
  second: [['every second', '*'], ['every 10 s', '*/10'], ['every 30 s', '*/30'], ['on the minute', '0']],
  minute: [['every minute', '*'], ['every 5 min', '*/5'], ['every 15 min', '*/15'], ['on the hour', '0'], ['half past', '30']],
  hour: [['every hour', '*'], ['every 2 h', '*/2'], ['09–17', '9-17'], ['midnight', '0'], ['09:00', '9']],
  dayOfMonth: [['every day', '*'], ['1st', '1'], ['15th', '15'], ['last day', 'L'], ['weekday nearest 15th', '15W'], ['last weekday', 'LW']],
  month: [['every month', '*'], ['quarterly', '1/3'], ['January', 'JAN'], ['Jan and Jul', 'JAN,JUL']],
  dayOfWeek: [['any day', '*'], ['weekdays', 'MON-FRI'], ['weekends', 'SAT,SUN'], ['Monday', 'MON'], ['first Monday', 'MON#1'], ['last Friday', 'FRIL']],
}

const RANGE: Record<CronEditorFieldName, string> = {
  second: '0–59',
  minute: '0–59',
  hour: '0–23',
  dayOfMonth: '1–31, L, W',
  month: '1–12, JAN–DEC',
  dayOfWeek: '0–7, SUN–SAT, L, #',
}

const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * A cron expression with its meaning spelled out: the schedule in words, the
 * next runs as real times in a real zone, and an error on the field that is
 * wrong rather than on the expression as a whole.
 *
 * Cron is read far more often than it is written, and most mistakes are a
 * field in the wrong slot or the day-of-month/day-of-week rule — both fields
 * restricted means *either* matches, which surprises nearly everyone. The run
 * list is the proof: it is computed in wall-clock time in the chosen zone, so
 * the night the clocks change shows a moved or doubled run instead of hiding
 * it. Each field can be edited on its own, with quick values for the common
 * cases, and the expression is rebuilt from them.
 */
export function CronEditor({
  label = 'Schedule',
  value,
  defaultValue = '0 9 * * MON-FRI',
  onValueChange,
  timeZone,
  defaultTimeZone,
  onTimeZoneChange,
  timeZones = ZONES,
  count = 5,
  from,
  locale,
  className,
}: CronEditorProps) {
  const uid = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const expression = value ?? uncontrolled
  const [zoneState, setZoneState] = useState(() => defaultTimeZone ?? localZone())
  const zone = timeZone ?? zoneState
  const [active, setActive] = useState<CronEditorFieldName>('minute')

  const set = (next: string) => {
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }
  const setZone = (next: string) => {
    if (timeZone === undefined) setZoneState(next)
    onTimeZoneChange?.(next)
  }

  const parsed = useMemo(() => parseCron(expression), [expression])
  const zoneOk = isValidZone(zone)
  const fromMs = from?.getTime()
  const runs = useMemo(
    () => (parsed.ok && zoneOk ? nextRuns(parsed.cron, zone, fromMs ?? Date.now(), count) : []),
    [parsed, zone, zoneOk, fromMs, count],
  )

  // The per-field inputs edit the expanded form, so a macro becomes its fields.
  const trimmed = expression.trim()
  const expanded = MACROS[trimmed.toLowerCase()] ?? trimmed
  const raw = expanded.startsWith('@') ? [] : expanded.split(/\s+/).filter(Boolean)
  const six = raw.length === 6
  const names: CronEditorFieldName[] = six
    ? ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
    : ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
  const parts = names.map((_, index) => raw[index] ?? '*')
  const fieldError = (name: CronEditorFieldName) => (parsed.ok ? undefined : parsed.errors.find((error) => error.field === name)?.message)
  const expressionError = parsed.ok ? undefined : parsed.errors.find((error) => error.field === 'expression')?.message
  const editField = (index: number, text: string) => {
    const next = [...parts]
    next[index] = text.replace(/\s+/g, '')
    set(next.join(' '))
  }
  const activeName = names.includes(active) ? active : names[0]
  const activeIndex = names.indexOf(activeName)

  const formatRun = useMemo(() => {
    if (!zoneOk) return () => ''
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: six ? '2-digit' : undefined,
      timeZoneName: 'short',
    })
    return (at: number) => fmt.format(new Date(at))
  }, [zone, zoneOk, locale, six])

  const zoneOptions = [...new Set([zone, ...timeZones])].map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))

  return (
    <div className={cn('flex w-full flex-col gap-4', className)}>
      <Field label={label} error={expressionError} hint="Five fields, or six with seconds first. @daily and friends work too.">
        <Input value={expression} onChange={(event) => set(event.target.value)} spellCheck={false} autoComplete="off" className="font-mono" />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12px] font-semibold text-ink">Fields</legend>
        <div className={cn('grid grid-cols-2 gap-2', six ? 'sm:grid-cols-6' : 'sm:grid-cols-5')}>
          {names.map((name, index) => {
            const error = fieldError(name)
            const id = `${uid}-${name}`
            return (
              <div key={name} className="flex min-w-0 flex-col gap-1">
                <label htmlFor={id} className="text-[11px] font-semibold text-ink-soft">
                  {CRON_SPECS[name].label}
                </label>
                <Input
                  id={id}
                  inputSize="sm"
                  value={parts[index]}
                  invalid={!!error}
                  onFocus={() => setActive(name)}
                  onChange={(event) => editField(index, event.target.value)}
                  aria-describedby={`${id}-note`}
                  spellCheck={false}
                  autoComplete="off"
                  className="px-3 font-mono"
                />
                <span id={`${id}-note`} className={cn('text-[10px] font-medium leading-tight', error ? 'text-danger' : 'text-ink-faint')}>
                  {error ?? RANGE[name]}
                </span>
              </div>
            )
          })}
        </div>
        <div role="group" aria-label={`Quick values for ${CRON_SPECS[activeName].label.toLowerCase()}`} className="flex flex-wrap items-center gap-1.5">
          <span aria-hidden="true" className="text-[11px] font-semibold text-ink-faint">
            {CRON_SPECS[activeName].label}:
          </span>
          {HELPERS[activeName].map(([text, field]) => (
            <button
              key={field}
              type="button"
              aria-pressed={parts[activeIndex] === field}
              onClick={() => editField(activeIndex, field)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                parts[activeIndex] === field ? 'border-transparent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 rounded-[var(--radius-tile)] border border-line bg-surface-sunken p-3.5">
        <p className="text-[13px] font-semibold leading-normal text-ink" aria-live="polite">
          {parsed.ok ? describeCron(parsed.cron) : 'Fix the highlighted field to see the schedule.'}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id={`${uid}-runs`} className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Next {count} runs
          </span>
          <Select label="Time zone" size="sm" options={zoneOptions} value={zone} onValueChange={setZone} />
        </div>
        {!zoneOk ? (
          <p className="text-[12px] font-medium text-danger">“{zone}” is not a time zone this browser knows.</p>
        ) : parsed.ok && runs.length === 0 ? (
          <p className="text-[12px] font-medium text-ink-soft">No run in the next eight years — check the day and month fields (31 February never comes).</p>
        ) : (
          <ol aria-labelledby={`${uid}-runs`} className="flex flex-col gap-1.5">
            {runs.map((run) => (
              <li key={run.at} className="flex flex-col">
                <span className="font-mono text-[12px] font-medium tabular-nums text-ink">{formatRun(run.at)}</span>
                {run.note && <span className="text-[11px] font-medium text-ink-soft">{run.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
