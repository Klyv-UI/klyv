'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type RadioSize = 'sm' | 'md'

const SIZES: Record<RadioSize, string> = {
  sm: 'size-4',
  md: 'size-[18px]',
}

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  dotSize?: RadioSize
  invalid?: boolean
}

/**
 * A native radio with the dial drawn on it. Grouping, labelling and roving
 * focus are RadioGroup's job — this is one control.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { className, dotSize = 'md', invalid = false, ...props },
  ref,
) {
  return (
    <span className={cn('relative inline-flex shrink-0', SIZES[dotSize])}>
      <input
        type="radio"
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'peer size-full cursor-pointer appearance-none rounded-full border bg-surface transition-colors',
          'border-line-strong hover:border-ink-faint',
          'checked:border-accent-strong checked:bg-accent-strong',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong',
          invalid && 'border-danger hover:border-danger',
          className,
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-ink opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  )
})
