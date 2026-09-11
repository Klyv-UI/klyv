import { cn } from '../../lib/cn'

export type SpinnerSize = 'sm' | 'md'

const SIZES: Record<SpinnerSize, string> = {
  sm: 'size-3.5 border-[1.5px]',
  md: 'size-4 border-2',
}

export interface SpinnerProps {
  size?: SpinnerSize
  /** Accessible description; omit inside a control that already announces busy. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Busy indicator. Inherits `currentColor`, so it reads correctly on every
 * Button variant without a tone prop of its own.
 */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-current border-r-transparent',
        SIZES[size],
        className,
      )}
    />
  )
}
