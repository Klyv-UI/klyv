'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type InputVariant = 'field' | 'bare'
export type InputSize = 'sm' | 'md'

const SIZES: Record<InputSize, string> = {
  sm: 'h-9 text-[12px]',
  md: 'h-10 text-[13px]',
}

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** `field` is the bordered pill; `bare` inherits type styles from its parent. */
  variant?: InputVariant
  inputSize?: InputSize
  /** Marks the control invalid and reddens the border. Pair with a message. */
  invalid?: boolean
  /** Decoration inside the field — an icon, a currency symbol. */
  leading?: ReactNode
  trailing?: ReactNode
  /** Class for the wrapper; `className` still targets the `<input>`. */
  containerClassName?: string
}

/**
 * Text entry. Labelling is the caller's job — pass `aria-label`, or wire a
 * `<label htmlFor>` to `id` — so the primitive never guesses at copy.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    containerClassName,
    variant = 'field',
    inputSize = 'md',
    invalid = false,
    leading,
    trailing,
    disabled,
    ...props
  },
  ref,
) {
  const field = variant === 'field'

  return (
    <div className={cn('relative', disabled && 'opacity-40', containerClassName)}>
      {leading && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center text-ink-faint">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full min-w-0 bg-transparent font-medium text-ink placeholder:text-ink-faint',
          // A field shows the global focus ring. A bare input sits inside
          // someone else's chrome, and that chrome draws the ring instead.
          !field && 'outline-none',
          'disabled:cursor-not-allowed',
          field && [
            'rounded-full border border-line bg-surface px-4 focus:border-line-strong',
            SIZES[inputSize],
            leading && 'pl-10',
            trailing && 'pr-10',
          ],
          field && invalid && 'border-danger focus:border-danger',
          className,
        )}
        {...props}
      />
      {trailing && (
        <span className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center text-ink-faint">
          {trailing}
        </span>
      )}
    </div>
  )
})
