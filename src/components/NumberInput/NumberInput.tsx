'use client'

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Input, type InputSize } from '../Input'
import { MinusIcon, PlusIcon } from '../internal/icons'

export type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type' | 'value' | 'onChange'
> & {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Control height, matching Input. */
  inputSize?: InputSize
  /** Marks the field as failing validation. Pair it with a message. */
  invalid?: boolean
  /** Hide the stepper buttons, leaving a plain numeric field. */
  steppers?: boolean
  /** Text after the figure, e.g. a unit. */
  suffix?: string
  /** Classes for the wrapper rather than the control itself. */
  containerClassName?: string
}

/**
 * A numeric field with stepper buttons. The committed value is always inside
 * the range, so the control never reports a number it would then have to
 * reject.
 *
 * What the person types is kept as a draft and only clamped when they finish —
 * on blur or Enter. Clamping every keystroke made ordinary typing impossible:
 * with `min={10}`, selecting the field and typing "25" produced 100, because
 * "2" was clamped to 10 before the "5" arrived, and an emptied field snapped
 * straight back to the minimum.
 *
 * The steppers are buttons rather than the native spinner so they are large
 * enough to hit on touch and follow the library button styling.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    onValueChange,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    step = 1,
    inputSize = 'md',
    invalid,
    steppers = true,
    suffix,
    disabled,
    containerClassName,
    className,
    onBlur,
    onFocus,
    onKeyDown,
    ...props
  },
  ref,
) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const [draft, setDraft] = useState(String(value))
  const editing = useRef(false)

  // Outside changes show straight away, but never overwrite what is being typed.
  useEffect(() => {
    if (!editing.current) setDraft(String(value))
  }, [value])

  const commit = (next: number) => {
    const settled = clamp(next)
    setDraft(String(settled))
    if (settled !== value) onValueChange(settled)
  }

  /** Settles the draft: a number is clamped into range, anything else reverts. */
  const settle = () => {
    const parsed = draft.trim() === '' ? Number.NaN : Number(draft)
    if (Number.isNaN(parsed)) setDraft(String(value))
    else commit(parsed)
  }

  return (
    <div className={cn('flex items-center gap-2', containerClassName)}>
      {steppers && (
        <IconButton
          icon={MinusIcon}
          label="Decrease"
          tone="muted"
          size={inputSize === 'sm' ? 'sm' : 'md'}
          disabled={disabled || value <= min}
          onClick={() => commit(value - step)}
        />
      )}
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        value={draft}
        min={min === Number.NEGATIVE_INFINITY ? undefined : min}
        max={max === Number.POSITIVE_INFINITY ? undefined : max}
        step={step}
        disabled={disabled}
        invalid={invalid}
        inputSize={inputSize}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          // A complete number that is already in range is reported as it is
          // typed, so a parent can react live. Anything else — empty, a lone
          // minus, 2 on the way to 25 — waits for the person to finish.
          const parsed = text.trim() === '' ? Number.NaN : Number(text)
          if (!Number.isNaN(parsed) && parsed >= min && parsed <= max && parsed !== value) onValueChange(parsed)
        }}
        onFocus={(event) => {
          editing.current = true
          onFocus?.(event)
        }}
        onBlur={(event) => {
          editing.current = false
          settle()
          onBlur?.(event)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') settle()
          onKeyDown?.(event)
        }}
        containerClassName="min-w-0 flex-1"
        className={cn(
          'tabular text-center [appearance:textfield]',
          '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          className,
        )}
        trailing={suffix}
        {...props}
      />
      {steppers && (
        <IconButton
          icon={PlusIcon}
          label="Increase"
          tone="muted"
          size={inputSize === 'sm' ? 'sm' : 'md'}
          disabled={disabled || value >= max}
          onClick={() => commit(value + step)}
        />
      )}
    </div>
  )
})
