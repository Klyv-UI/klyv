'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export type SwitchSize = 'sm' | 'md'

const TRACK: Record<SwitchSize, string> = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11',
}

const KNOB: Record<SwitchSize, string> = {
  sm: 'size-4 peer-checked:translate-x-4',
  md: 'size-5 peer-checked:translate-x-5',
}

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> & {
  switchSize?: SwitchSize
}

/**
 * A native checkbox presented as a track and knob, so it submits with a form
 * and is reachable with the space key like any other checkbox.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, switchSize = 'md', ...props },
  ref,
) {
  return (
    <span className={cn('relative inline-flex shrink-0 items-center', TRACK[switchSize], className)}>
      <input
        type="checkbox"
        role="switch"
        ref={ref}
        className={cn(
          'peer size-full cursor-pointer appearance-none rounded-full bg-line-strong transition-colors',
          'checked:bg-accent-strong hover:bg-ink-faint checked:hover:bg-accent',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-0.5 rounded-full bg-white shadow-[var(--shadow-tile)] transition-transform',
          KNOB[switchSize],
        )}
      />
    </span>
  )
})
