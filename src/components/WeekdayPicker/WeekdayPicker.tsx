'use client'

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'

/** 0 is Sunday through 6 Saturday, as `Date.getDay()` numbers them. */
export type WeekdayPickerDay = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type WeekdayPickerSize = 'sm' | 'md'

export interface WeekdayPickerProps {
  /** Selected days, when controlled. */
  value?: WeekdayPickerDay[]
  /** Starting selection when uncontrolled. */
  defaultValue?: WeekdayPickerDay[]
  /** Called with the new selection, sorted Sunday-first as `getDay()` numbers. */
  onValueChange?: (value: WeekdayPickerDay[]) => void
  /** The group’s visible name — "Repeat on". */
  label: string
  /** Hide the label visually, keeping it as the group’s name. */
  hideLabel?: boolean
  /** Locale for day names and, unless overridden, the first day of the week. */
  locale?: string
  /** Override the first day of the week. */
  weekStartsOn?: WeekdayPickerDay
  /** Show Weekdays, Weekends and Every day shortcuts. */
  presets?: boolean
  size?: WeekdayPickerSize
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

interface WeekInfo {
  firstDay: number
  weekend: number[]
}

/** Intl numbers days 1 (Monday) to 7 (Sunday). */
function weekInfo(locale: string | undefined): WeekInfo {
  try {
    const intl = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      weekInfo?: WeekInfo
      getWeekInfo?: () => WeekInfo
    }
    const info = intl.getWeekInfo?.() ?? intl.weekInfo
    if (info) return info
    // No weekInfo support: the US-style week is the common exception to Monday.
    return { firstDay: /^(en-US|en-CA|ja|ko|zh-TW|he|pt-BR)/.test(intl.baseName) ? 7 : 1, weekend: [6, 7] }
  } catch {
    return { firstDay: 1, weekend: [6, 7] }
  }
}

const fromIntl = (day: number) => (day % 7) as WeekdayPickerDay
// 7 January 2024 was a Sunday, so adding a day index gives that weekday.
const nameOf = (day: number, locale: string | undefined, weekday: 'long' | 'short' | 'narrow') =>
  new Intl.DateTimeFormat(locale, { weekday }).format(new Date(2024, 0, 7 + day))

/**
 * Seven days as chips, in the order the reader’s calendar puts them.
 *
 * A week starts on Monday in most of the world and on Sunday in the US, and
 * the weekend is Friday and Saturday in much of the Middle East. Hard-coding
 * "Mon–Sun" and a Saturday–Sunday weekend gets all of that wrong for someone,
 * so the order, the names and the Weekends preset come from `Intl` for the
 * locale. The value is always `getDay()` numbers, whatever the display order,
 * so the scheduling code never has to know.
 *
 * Each chip is a toggle button with the full day name as its label; the group
 * is one tab stop, with arrows moving between days and Space toggling. The
 * presets are plain buttons after it — they set the selection, they are not
 * a state of their own.
 */
export function WeekdayPicker({
  value: controlled,
  defaultValue = [],
  onValueChange,
  label,
  hideLabel = false,
  locale,
  weekStartsOn,
  presets = true,
  size = 'md',
  disabled = false,
  className,
}: WeekdayPickerProps) {
  const [own, setOwn] = useState<WeekdayPickerDay[]>(defaultValue)
  const [focusIndex, setFocusIndex] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const labelId = useId()
  const value = controlled ?? own

  const { order, weekend, names } = useMemo(() => {
    const info = weekInfo(locale)
    const first = weekStartsOn ?? fromIntl(info.firstDay)
    const days = Array.from({ length: 7 }, (_, index) => ((first + index) % 7) as WeekdayPickerDay)
    return {
      order: days,
      weekend: info.weekend.map(fromIntl),
      names: days.map((day) => ({ long: nameOf(day, locale, 'long'), short: nameOf(day, locale, size === 'sm' ? 'narrow' : 'short') })),
    }
  }, [locale, weekStartsOn, size])

  const set = (next: WeekdayPickerDay[]) => {
    const sorted = [...new Set(next)].sort((a, b) => a - b)
    if (controlled === undefined) setOwn(sorted)
    onValueChange?.(sorted)
  }

  const toggle = (day: WeekdayPickerDay) => set(value.includes(day) ? value.filter((item) => item !== day) : [...value, day])

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: 6 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = (moves[event.key] + 7) % 7
    setFocusIndex(next)
    refs.current[next]?.focus()
  }

  const same = (days: WeekdayPickerDay[]) => days.length === value.length && days.every((day) => value.includes(day))
  const weekdays = order.filter((day) => !weekend.includes(day))
  const presetList = [
    { key: 'weekdays', text: 'Weekdays', days: weekdays },
    { key: 'weekends', text: 'Weekends', days: weekend },
    { key: 'every', text: 'Every day', days: order },
  ]

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-40', className)}>
      <span id={labelId} className={cn('text-[12px] font-bold text-ink', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {order.map((day, index) => {
          const on = value.includes(day)
          return (
            <button
              key={day}
              ref={(node) => {
                refs.current[index] = node
              }}
              type="button"
              aria-pressed={on}
              aria-label={names[index].long}
              title={names[index].long}
              disabled={disabled}
              tabIndex={index === focusIndex ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onClick={() => toggle(day)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'inline-flex items-center justify-center rounded-full border font-semibold leading-none transition-colors disabled:pointer-events-none',
                size === 'sm' ? 'size-8 text-[12px]' : 'h-9 min-w-11 px-2.5 text-[13px]',
                on ? 'border-transparent bg-accent text-accent-ink hover:bg-accent-strong' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
              )}
            >
              <span aria-hidden="true">{names[index].short}</span>
            </button>
          )
        })}
      </div>
      {presets && (
        <div className="flex flex-wrap gap-1">
          {presetList.map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={disabled}
              onClick={() => set(preset.days)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-surface-muted hover:text-ink disabled:pointer-events-none',
                same(preset.days) ? 'bg-surface-muted text-ink' : 'text-ink-soft',
              )}
            >
              {preset.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
