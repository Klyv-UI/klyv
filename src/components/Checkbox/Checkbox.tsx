'use client'

import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type CheckboxSize = 'sm' | 'md'

const SIZES: Record<CheckboxSize, string> = {
  sm: 'size-4',
  md: 'size-[18px]',
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  boxSize?: CheckboxSize
  /** Neither checked nor unchecked — the mixed state of a parent checkbox. */
  indeterminate?: boolean
  invalid?: boolean
}

/**
 * A native checkbox with the box drawn on it. It carries no label and no
 * layout: pair it with `Label`, or let Field do the wiring.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, boxSize = 'md', indeterminate = false, invalid = false, ...props },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <span className={cn('relative inline-flex shrink-0', SIZES[boxSize])}>
      <input
        type="checkbox"
        ref={(node) => {
          innerRef.current = node
          if (typeof forwardedRef === 'function') forwardedRef(node)
          else if (forwardedRef) {
            ;(forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node
          }
        }}
        aria-invalid={invalid || undefined}
        className={cn(
          'peer size-full cursor-pointer appearance-none rounded-[var(--radius-6)] border bg-surface transition-colors',
          'border-line-strong hover:border-ink-faint',
          'checked:border-accent-strong checked:bg-accent-strong',
          'indeterminate:border-accent-strong indeterminate:bg-accent-strong',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong',
          invalid && 'border-danger hover:border-danger',
          className,
        )}
        {...props}
      />
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 size-full scale-75 text-accent-ink opacity-0 transition-opacity',
          indeterminate ? 'peer-indeterminate:opacity-100' : 'peer-checked:opacity-100',
        )}
      >
        {indeterminate ? (
          <path d="M4 8h8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" fill="none" />
        ) : (
          <path
            d="M3.5 8.5l3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
    </span>
  )
})
