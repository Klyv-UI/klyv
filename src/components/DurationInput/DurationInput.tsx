'use client'

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

export type DurationInputUnit = 'h' | 'm' | 's'

export interface DurationInputProps {
  /** Controlled value, in seconds. */
  value?: number
  /** Starting value when uncontrolled, in seconds. */
  defaultValue?: number
  /** Called with the total in seconds after every committed change. */
  onValueChange?: (seconds: number) => void
  /** Accessible name for the group. */
  label: string
  /** Show a seconds segment. Off, the value is still seconds but moves in whole minutes. */
  showSeconds?: boolean
  /** Shortest allowed duration, in seconds. */
  min?: number
  /** Longest allowed duration, in seconds. */
  max?: number
  /** Marks the control as failing validation. */
  invalid?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
  /** Goes on the hours segment, so a Field label points at it. */
  id?: string
  /** Forwarded from Field. */
  'aria-describedby'?: string
  /** Merged last, so it wins. */
  className?: string
}

const SIZE: Record<DurationInputUnit, number> = { h: 3600, m: 60, s: 1 }
const NAME: Record<DurationInputUnit, string> = { h: 'Hours', m: 'Minutes', s: 'Seconds' }

/**
 * Reads "1h 30m", "90m", "1:30", "1:30:15" or "2.5h". Returns seconds, or null
 * for anything it cannot read with confidence.
 */
function parseDuration(text: string): number | null {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) return null
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(trimmed)
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0)
  const parts = [...trimmed.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/g)]
  if (parts.length === 0 || parts.map((part) => part[0]).join('').replace(/\s/g, '') !== trimmed.replace(/\s/g, '')) {
    return null
  }
  return Math.round(parts.reduce((total, [, amount, unit]) => total + Number(amount) * SIZE[unit[0] as DurationInputUnit], 0))
}

const split = (total: number) => ({ h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 })

/**
 * A length of time as hours, minutes and optionally seconds, stored as one
 * number of seconds.
 *
 * Two separate number inputs let "90" sit in a minutes box and leave every
 * caller to normalise it; one free-text box is easy to type in and hard to
 * nudge. This is both: each segment is a spinbutton the arrow keys step
 * through — carrying into the next unit, never wrapping silently — and typing
 * "1h 30m" works because a unit letter moves on to the next segment. Pasting a
 * whole duration fills every segment at once. Limits are applied when the value
 * is committed, so typing "0" on the way to "05" is never corrected mid-word.
 */
export function DurationInput({
  value,
  defaultValue = 0,
  onValueChange,
  label,
  showSeconds = false,
  min = 0,
  max,
  invalid = false,
  disabled = false,
  id,
  'aria-describedby': describedBy,
  className,
}: DurationInputProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const total = value ?? uncontrolled
  const [drafts, setDrafts] = useState<Partial<Record<DurationInputUnit, string>>>({})
  const refs = useRef<Partial<Record<DurationInputUnit, HTMLInputElement | null>>>({})
  const units: DurationInputUnit[] = showSeconds ? ['h', 'm', 's'] : ['h', 'm']
  const parts = split(total)

  const clamp = (seconds: number) => Math.max(min, max === undefined ? seconds : Math.min(max, seconds))

  const commit = (seconds: number) => {
    const next = clamp(Math.max(0, Math.round(seconds)))
    setDrafts({})
    if (value === undefined) setUncontrolled(next)
    if (next !== total) onValueChange?.(next)
  }

  /** The total if every draft were accepted as typed. */
  const fromDrafts = (overrides: Partial<Record<DurationInputUnit, string>>) => {
    const merged = { ...drafts, ...overrides }
    return units.reduce((sum, unit) => sum + Number(merged[unit] ?? parts[unit]) * SIZE[unit], 0)
  }

  const focusUnit = (index: number) => {
    const unit = units[index]
    const node = unit && refs.current[unit]
    if (node) {
      node.focus()
      node.select()
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, unit: DurationInputUnit, index: number) => {
    const step = SIZE[unit] * (event.shiftKey ? (unit === 'h' ? 1 : 15) : 1)
    const base = fromDrafts({})
    const keys: Record<string, () => void> = {
      ArrowUp: () => commit(base + step),
      ArrowDown: () => commit(base - step),
      PageUp: () => commit(base + SIZE[unit] * 10),
      PageDown: () => commit(base - SIZE[unit] * 10),
      Home: () => commit(min),
      End: () => max !== undefined && commit(max),
      ArrowRight: () => focusUnit(index + 1),
      ArrowLeft: () => focusUnit(index - 1),
      Enter: () => commit(base),
    }
    // A unit letter or a colon is a separator: "1h 30m" types straight through.
    if (/^[hms:]$/i.test(event.key)) {
      event.preventDefault()
      const target = event.key === ':' ? index + 1 : units.indexOf(event.key.toLowerCase() as DurationInputUnit) + 1
      if (target > 0) focusUnit(Math.min(target, units.length - 1))
      return
    }
    const handler = keys[event.key]
    if (!handler) return
    // Left and Right only leave a segment from its edge, so the caret still moves inside "120".
    const input = event.currentTarget
    if (event.key === 'ArrowRight' && input.selectionEnd !== input.value.length) return
    if (event.key === 'ArrowLeft' && input.selectionStart !== 0) return
    event.preventDefault()
    handler()
  }

  const onChange = (unit: DurationInputUnit, index: number, text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, unit === 'h' ? 4 : 2)
    setDrafts((current) => ({ ...current, [unit]: digits }))
    // Two digits fill a minutes or seconds segment; move on as a clock field would.
    if (unit !== 'h' && digits.length === 2 && index < units.length - 1) focusUnit(index + 1)
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const parsed = parseDuration(event.clipboardData.getData('text'))
    if (parsed === null) return
    event.preventDefault()
    commit(parsed)
  }

  const describe = (seconds: number) =>
    units
      .map((unit) => [split(seconds)[unit], NAME[unit].toLowerCase()] as const)
      .filter(([amount], index) => amount > 0 || index === 0)
      .map(([amount, name]) => `${amount} ${amount === 1 ? name.slice(0, -1) : name}`)
      .join(' ')

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && Object.keys(drafts).length) {
          commit(fromDrafts({}))
        }
      }}
      className={cn(
        'inline-flex h-10 items-center gap-1 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink',
        'has-[input:focus]:border-line-strong has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus has-[input:focus-visible]:outline-solid',
        invalid && 'border-danger',
        disabled && 'opacity-40',
        className,
      )}
    >
      {units.map((unit, index) => {
        const ceiling = unit === 'h' ? (max === undefined ? undefined : Math.floor(max / 3600)) : 59
        return (
          <label key={unit} className="flex items-baseline">
            <input
              ref={(node) => {
                refs.current[unit] = node
              }}
              id={index === 0 ? id : undefined}
              role="spinbutton"
              inputMode="numeric"
              autoComplete="off"
              aria-label={NAME[unit]}
              aria-valuenow={parts[unit]}
              aria-valuemin={0}
              aria-valuemax={ceiling}
              aria-valuetext={describe(total)}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              value={drafts[unit] ?? (unit === 'h' ? String(parts[unit]) : String(parts[unit]).padStart(2, '0'))}
              onChange={(event) => onChange(unit, index, event.target.value)}
              onKeyDown={(event) => onKeyDown(event, unit, index)}
              onPaste={onPaste}
              onFocus={(event) => event.currentTarget.select()}
              style={{ width: `${unit === 'h' ? Math.max(2, String(parts.h).length) + 0.5 : 2.5}ch` }}
              className="tabular rounded-[var(--radius-6)] bg-transparent text-right outline-none focus:bg-accent-soft disabled:cursor-not-allowed"
            />
            <span aria-hidden="true" className="pl-0.5 pr-1 text-ink-faint">
              {unit}
            </span>
          </label>
        )
      })}
    </div>
  )
}
