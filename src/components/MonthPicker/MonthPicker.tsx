'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

/** A span of months as `yyyy-mm` strings. `end` is missing while the second click is pending. */
export interface MonthPickerRange {
  start: string
  end?: string
}

interface MonthPickerBaseProps {
  /** Earliest selectable month, `yyyy-mm`. */
  min?: string
  /** Latest selectable month, `yyyy-mm`. */
  max?: string
  /** Accessible name for the grid. */
  label?: string
  /** BCP 47 locale for month names. */
  locale?: string
  /** Merged last, so it wins. */
  className?: string
}

export interface MonthPickerSingleProps extends MonthPickerBaseProps {
  /** Pick one month. */
  range?: false
  /** Controlled month, `yyyy-mm`. */
  value?: string
  /** Starting month when uncontrolled. */
  defaultValue?: string
  /** Called with the chosen `yyyy-mm`. */
  onValueChange?: (value: string) => void
}

export interface MonthPickerRangeProps extends MonthPickerBaseProps {
  /** Pick a start and an end month with two presses. */
  range: true
  /** Controlled range. */
  value?: MonthPickerRange
  /** Starting range when uncontrolled. */
  defaultValue?: MonthPickerRange
  /** Called after each press: once with only `start`, then with both ends in order. */
  onValueChange?: (value: MonthPickerRange) => void
}

export type MonthPickerProps = MonthPickerSingleProps | MonthPickerRangeProps

const key = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`
const parse = (value: string) => {
  const [year, month] = value.split('-').map(Number)
  return { year, month: month - 1 }
}
const today = () => key(new Date().getFullYear(), new Date().getMonth())

/**
 * A year of months as a 4×3 grid — for billing periods, report ranges and card
 * expiries, where a day-level calendar asks for precision nobody has.
 *
 * Keyboard works as in Calendar: arrows move by one month or one row, Home and
 * End go to the ends of a row, PageUp and PageDown change year, and moving past
 * December turns the year over. Months outside `min`/`max` stay focusable but
 * cannot be chosen, so arrowing never jumps unpredictably over a gap.
 */
export function MonthPicker(props: MonthPickerProps) {
  const { min, max, label = 'Choose a month', locale = 'en-US', className } = props
  const [uncontrolled, setUncontrolled] = useState(props.defaultValue)
  const current = props.value ?? uncontrolled
  const range = props.range ? (current as MonthPickerRange | undefined) : undefined
  const single = props.range ? undefined : (current as string | undefined)
  const anchor = range?.start ?? single ?? today()
  const [focused, setFocused] = useState(anchor)
  const [year, setYear] = useState(parse(anchor).year)
  const gridRef = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    gridRef.current?.querySelector<HTMLElement>('button[tabindex="0"]')?.focus()
  }, [focused, year])

  // A controlled picker follows its value to another year.
  const chosenKey = range?.start ?? single
  useEffect(() => {
    if (!chosenKey) return
    setFocused(chosenKey)
    setYear(parse(chosenKey).year)
  }, [chosenKey])

  const outside = (month: string) => (min !== undefined && month < min) || (max !== undefined && month > max)

  const choose = (month: string) => {
    if (outside(month)) return
    setFocused(month)
    if (props.range) {
      const next: MonthPickerRange =
        !range || range.end !== undefined ? { start: month } : month < range.start ? { start: month, end: range.start } : { start: range.start, end: month }
      if (props.value === undefined) setUncontrolled(next)
      props.onValueChange?.(next)
    } else {
      if (props.value === undefined) setUncontrolled(month)
      props.onValueChange?.(month)
    }
  }

  const go = (month: string) => {
    moveFocus.current = true
    setFocused(month)
    setYear(parse(month).year)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const { year: y, month: m } = parse(focused)
    const shift = (delta: number) => {
      const total = y * 12 + m + delta
      return key(Math.floor(total / 12), ((total % 12) + 12) % 12)
    }
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shift(-1),
      ArrowRight: () => shift(1),
      ArrowUp: () => shift(-4),
      ArrowDown: () => shift(4),
      Home: () => shift(-(m % 4)),
      End: () => shift(3 - (m % 4)),
      PageUp: () => shift(-12),
      PageDown: () => shift(12),
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    go(move())
  }

  const names = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(2000, month, 1)
    return {
      short: date.toLocaleString(locale, { month: 'short' }),
      long: date.toLocaleString(locale, { month: 'long' }),
    }
  })
  // The focused month is the tab stop only while it is on screen. After the
  // year buttons change the view, the first month there takes over.
  const focusInView = parse(focused).year === year
  const stepYear = (delta: number) => setYear(year + delta)

  return (
    <div className={cn('flex w-[264px] flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeftIcon} label="Previous year" size="xs" onClick={() => stepYear(-1)} disabled={min !== undefined && `${year - 1}-12` < min} />
        <span aria-live="polite" className="text-[14px] font-bold tabular-nums text-ink">
          {year}
        </span>
        <IconButton icon={ChevronRightIcon} label="Next year" size="xs" onClick={() => stepYear(1)} disabled={max !== undefined && `${year + 1}-01` > max} />
      </div>
      <div ref={gridRef} role="grid" aria-label={`${label}, ${year}`} onKeyDown={onKeyDown} className="flex flex-col gap-1">
        {[0, 1, 2].map((row) => (
          <div key={row} role="row" className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 3].map((col) => {
              const month = row * 4 + col
              const id = key(year, month)
              const disabled = outside(id)
              const isStart = range?.start === id
              const isEnd = range?.end === id
              const between = range?.end !== undefined && id > range.start && id < range.end
              const selected = single === id || isStart || isEnd
              const stop = focusInView ? focused === id : month === 0
              return (
                <div key={id} role="gridcell" aria-selected={selected || between}>
                  <button
                    type="button"
                    tabIndex={stop ? 0 : -1}
                    aria-label={`${names[month].long} ${year}`}
                    aria-disabled={disabled || undefined}
                    onClick={() => choose(id)}
                    onFocus={() => setFocused(id)}
                    className={cn(
                      'flex h-10 w-full items-center justify-center rounded-[10px] text-[13px] transition-colors',
                      selected
                        ? 'bg-accent font-bold text-accent-ink'
                        : between
                          ? 'bg-accent-soft font-semibold text-ink'
                          : 'font-medium text-ink hover:bg-surface-muted',
                      id === today() && !selected && 'ring-1 ring-inset ring-line-strong',
                      disabled && 'cursor-not-allowed text-ink-faint line-through opacity-50 hover:bg-transparent',
                    )}
                  >
                    {names[month].short}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
