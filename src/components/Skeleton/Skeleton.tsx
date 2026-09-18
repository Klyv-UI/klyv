import { cn } from '../../lib/cn'

export type SkeletonShape = 'text' | 'rect' | 'circle'

export interface SkeletonProps {
  shape?: SkeletonShape
  /** Any CSS length; defaults to filling the container. */
  width?: number | string
  /** Any CSS length. `text` derives its height from the line it stands in for. */
  height?: number | string
  /** Number of stacked lines. `text` only. */
  lines?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Loading placeholder. It knows only geometry, never what it stands in for,
 * so a caller sizes it to match the real content. Hidden from assistive tech:
 * the container should carry `aria-busy` instead.
 */
export function Skeleton({ shape = 'text', width, height, lines = 1, className }: SkeletonProps) {
  const base = 'motion-safe-only animate-pulse bg-surface-muted'

  if (shape === 'text' && lines > 1) {
    return (
      <span aria-hidden="true" className={cn('flex flex-col gap-2', className)} style={{ width }}>
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={cn(base, 'block h-3 rounded-[var(--radius-6)]')}
            style={{ width: index === lines - 1 ? '70%' : '100%' }}
          />
        ))}
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        base,
        'block',
        shape === 'circle' && 'rounded-full',
        shape === 'rect' && 'rounded-[var(--radius-glyph)]',
        shape === 'text' && 'h-3 rounded-[var(--radius-6)]',
        className,
      )}
      style={{ width, height }}
    />
  )
}
