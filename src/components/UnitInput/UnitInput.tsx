'use client'

import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { ChevronDownIcon } from '../internal/icons'

export interface UnitInputUnit {
  /** The value passed back, and the text shown in the selector unless `label` is given. */
  value: string
  label?: string
  /** How many of the base unit one of this is — px 1, rem 16; g 1, kg 1000. Units without one are never converted. */
  factor?: number
  min?: number
  max?: number
  /** Arrow-key step for this unit. Shift multiplies it by ten. */
  step?: number
}

export type UnitInputSize = 'sm' | 'md'

export interface UnitInputProps {
  /** The units on offer, in order. */
  units: UnitInputUnit[]
  /** The number, when controlled. null is empty. */
  value?: number | null
  /** Starting number when uncontrolled. */
  defaultValue?: number | null
  /** Called when a number is committed — Enter, blur, an arrow key, or a converted unit change. */
  onValueChange?: (value: number | null) => void
  /** The unit, when controlled. */
  unit?: string
  /** Starting unit when uncontrolled. Defaults to the first. */
  defaultUnit?: string
  /** Called when the unit changes. */
  onUnitChange?: (unit: string) => void
  /** Convert the number when the unit changes, where both units have a factor. */
  convert?: boolean
  /** Decimal places kept after a conversion. */
  precision?: number
  /** Accessible name for the number. */
  label: string
  /** Accessible name for the unit selector. */
  unitLabel?: string
  placeholder?: string
  size?: UnitInputSize
  /** Marks the control invalid. Field sets this. */
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  /** Goes on the number input, so a Field label points at it. */
  id?: string
  'aria-describedby'?: string
  /** Merged onto the wrapper. */
  className?: string
}

const round = (value: number, places: number) => {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

const parse = (text: string): number | null | undefined => {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const number = Number(cleaned)
  return Number.isFinite(number) ? number : undefined
}

/**
 * A number and its unit, as one control.
 *
 * "16" means nothing until you know whether it is pixels or rem, and a unit
 * chosen in a separate dropdown elsewhere on the form gets out of step with
 * the number it qualifies. Here the selector sits inside the field, and
 * changing it can convert the number — 16px becomes 1rem, 2kg becomes 4.41lb —
 * so the quantity stays the same while its expression changes. Units that do
 * not convert, like %, keep the digits as typed.
 *
 * Limits and step belong to the unit, because a sensible max of 200px is a
 * silly max of 200rem. The number is a spinbutton: Up and Down step, Shift
 * steps by ten, and typing is free until Enter or leaving the field, when the
 * value is clamped. The selector is a native select, which every keyboard and
 * screen reader already knows how to drive.
 */
export function UnitInput({
  units,
  value: controlledValue,
  defaultValue = null,
  onValueChange,
  unit: controlledUnit,
  defaultUnit,
  onUnitChange,
  convert = true,
  precision = 2,
  label,
  unitLabel = 'Unit',
  placeholder,
  size = 'md',
  invalid = false,
  disabled = false,
  required,
  id,
  'aria-describedby': describedBy,
  className,
}: UnitInputProps) {
  const [ownValue, setOwnValue] = useState<number | null>(defaultValue)
  const [ownUnit, setOwnUnit] = useState(defaultUnit ?? units[0]?.value ?? '')
  const value = controlledValue !== undefined ? controlledValue : ownValue
  const unitValue = controlledUnit ?? ownUnit
  const unit = units.find((item) => item.value === unitValue) ?? units[0]
  const [draft, setDraft] = useState<string | null>(null)
  const generatedId = useId()
  const inputId = id ?? generatedId

  // A new value from outside replaces whatever is half-typed.
  useEffect(() => setDraft(null), [controlledValue])

  const clamp = (number: number, target = unit) =>
    Math.min(target?.max ?? Infinity, Math.max(target?.min ?? -Infinity, number))

  const commitValue = (next: number | null) => {
    setDraft(null)
    if (next === value) return
    if (controlledValue === undefined) setOwnValue(next)
    onValueChange?.(next)
  }

  const commitDraft = () => {
    if (draft === null) return
    const parsed = parse(draft)
    commitValue(parsed === undefined ? value : parsed === null ? null : clamp(parsed))
  }

  const changeUnit = (nextUnit: string) => {
    const target = units.find((item) => item.value === nextUnit)
    if (!target) return
    const current = draft === null ? value : (parse(draft) ?? value)
    if (controlledUnit === undefined) setOwnUnit(nextUnit)
    onUnitChange?.(nextUnit)
    if (current === null) return setDraft(null)
    const converted = convert && unit?.factor && target.factor ? round((current * unit.factor) / target.factor, precision) : current
    commitValue(clamp(converted, target))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitDraft()
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const base = (draft === null ? value : parse(draft)) ?? unit?.min ?? 0
    const step = (unit?.step ?? 1) * (event.shiftKey ? 10 : 1)
    const places = Math.max(0, (String(unit?.step ?? 1).split('.')[1] ?? '').length)
    commitValue(clamp(round(base + (event.key === 'ArrowUp' ? step : -step), Math.max(places, precision))))
  }

  const text = draft ?? (value === null ? '' : String(value))
  const unitName = unit?.label ?? unit?.value ?? ''

  return (
    <div
      className={cn(
        'flex w-full items-center rounded-full border border-line bg-surface focus-within:border-line-strong',
        size === 'sm' ? 'h-9 text-[12px]' : 'h-10 text-[13px]',
        invalid && 'border-danger focus-within:border-danger',
        disabled && 'opacity-40',
        className,
      )}
    >
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value ?? undefined}
        aria-valuemin={unit?.min}
        aria-valuemax={unit?.max}
        aria-valuetext={value === null ? undefined : `${value} ${unitName}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        className="h-full min-w-0 flex-1 rounded-l-full bg-transparent pl-4 pr-2 font-medium tabular-nums text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
      />
      <span className="relative flex h-full shrink-0 items-center border-l border-line">
        <select
          aria-label={`${unitLabel} for ${label}`}
          value={unit?.value}
          disabled={disabled}
          onChange={(event) => changeUnit(event.target.value)}
          className="h-full cursor-pointer appearance-none rounded-r-full bg-transparent pl-3 pr-7 font-semibold text-ink disabled:cursor-not-allowed"
        >
          {units.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label ?? item.value}
            </option>
          ))}
        </select>
        <ChevronDownIcon size={11} className="pointer-events-none absolute right-2.5 text-ink-faint" />
      </span>
    </div>
  )
}
