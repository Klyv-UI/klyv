import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export type StatusDotTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
export type StatusDotSize = 'sm' | 'md'

const TONES: Record<StatusDotTone, string> = {
  accent: 'bg-accent-strong',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-ink-faint',
}

const SIZES: Record<StatusDotSize, string> = {
  sm: 'size-[6px]',
  md: 'size-2',
}

export interface StatusDotProps {
  tone?: StatusDotTone
  size?: StatusDotSize
  /** Halo that lifts the dot off whatever it overlaps — as on the bell icon. */
  ring?: boolean
  /** Announced to assistive tech; without it the dot is decorative. */
  label?: string
  /** Merged last, so it wins. */
  className?: string
}

/** The unread marker on the notification bell, generalised to five tones. */
export function StatusDot({ tone = 'accent', size = 'sm', ring = false, label, className }: StatusDotProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-block shrink-0 rounded-full',
        SIZES[size],
        TONES[tone],
        ring && 'ring-2 ring-white',
        className,
      )}
    >
      {label && <VisuallyHidden>{label}</VisuallyHidden>}
    </span>
  )
}
