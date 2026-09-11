import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'
import { Text } from '../Text'

export interface LoadingOverlayProps {
  /** Whether the overlay is showing. */
  active: boolean
  /** Announced while busy, and shown beside the spinner when visible is set. */
  label?: string
  /** Show the label under the spinner. */
  showLabel?: boolean
  /** Blur the content behind the scrim. */
  blur?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A scrim over the region it sits in. Place it inside a relatively positioned
 * container and set aria-busy on that container — the overlay reports progress
 * but the container is what is actually busy.
 *
 * It covers the content rather than replacing it, so the layout cannot shift
 * while loading. When the shape of the content is known in advance, prefer
 * Skeleton: it tells the reader more.
 */
export function LoadingOverlay({
  active,
  label = 'Loading',
  showLabel = false,
  blur = false,
  className,
}: LoadingOverlayProps) {
  if (!active) return null

  return (
    <div
      className={cn(
        'absolute inset-0 z-[var(--z-raised)] flex flex-col items-center justify-center gap-2',
        'rounded-[inherit] bg-surface/70',
        blur && 'backdrop-blur-[2px]',
        className,
      )}
    >
      <Spinner label={showLabel ? undefined : label} className="text-ink-soft" />
      {showLabel && (
        <Text size="caption" weight="medium" tone="faint" role="status" aria-live="polite">
          {label}
        </Text>
      )}
    </div>
  )
}
