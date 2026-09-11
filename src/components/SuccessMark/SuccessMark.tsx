import { cn } from '../../lib/cn'
import { VisuallyHidden } from '../VisuallyHidden'

export type SuccessMarkSize = 'sm' | 'md' | 'lg'

const SIZES: Record<SuccessMarkSize, number> = { sm: 32, md: 48, lg: 72 }

export interface SuccessMarkProps {
  size?: SuccessMarkSize
  /** Announced when it appears. */
  label?: string
  /** Draw the tick only, without the accent disc behind it. */
  bare?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The confirmation tick at the end of a flow. The stroke draws itself once on
 * mount; under prefers-reduced-motion it simply appears complete.
 */
export function SuccessMark({
  size = 'md',
  label = 'Done',
  bare = false,
  className,
}: SuccessMarkProps) {
  const px = SIZES[size]

  return (
    <span
      role="status"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        !bare && 'bg-accent',
        className,
      )}
      style={{ width: px, height: px }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(px * 0.55)}
        height={Math.round(px * 0.55)}
        aria-hidden="true"
        className={bare ? 'text-success' : 'text-accent-ink'}
      >
        <path
          d="M5 12.5l4.5 4.5L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="32"
          className="motion-safe-only animate-[success-mark_450ms_ease-out_forwards]"
        />
      </svg>
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}
