import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ButtonGroupVariant = 'track' | 'attached'

export interface ButtonGroupProps {
  /** The buttons. Adjacent corners are squared automatically. */
  children: ReactNode
  /** track is the lifted white rail the dashboard uses; attached joins the
   *  buttons into one outlined unit. */
  variant?: ButtonGroupVariant
  /** Accessible name for the set. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Groups related buttons into one visual unit. It supplies the container only —
 * each child stays a real Button, so it keeps its own focus ring and semantics.
 *
 * For a set where exactly one option is chosen, use SegmentedControl: this has
 * no selection model of its own.
 */
export function ButtonGroup({ children, variant = 'track', label, className }: ButtonGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center',
        variant === 'track'
          ? 'gap-0.5 rounded-full bg-surface p-1 shadow-[var(--shadow-tile)]'
          : cn(
              'gap-0 overflow-hidden rounded-full border border-line-strong',
              '[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none',
              '[&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-l-line-strong',
            ),
        className,
      )}
    >
      {children}
    </div>
  )
}
