'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
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
 * A numeric field with stepper buttons. Values are clamped on every change, so
 * the control can never hold a number outside its own range — an invalid state
 * the user would then have to be told about.
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
    ...props
  },
  ref,
) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  const commit = (next: number) => onValueChange(clamp(Number.isNaN(next) ? min : next))

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
        value={String(value)}
        min={min === Number.NEGATIVE_INFINITY ? undefined : min}
        max={max === Number.POSITIVE_INFINITY ? undefined : max}
        step={step}
        disabled={disabled}
        invalid={invalid}
        inputSize={inputSize}
        onChange={(event) => commit(Number(event.target.value))}
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
