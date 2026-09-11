import type { CSSProperties, ElementType } from 'react'
import { cn } from '../../lib/cn'

export interface GlitchTextProps {
  /** Plain text — the layers are copies of it, so it cannot be markup. */
  children: string
  /** Seconds between bursts. The keyframe spends most of its time clean. */
  duration?: number
  /** Only glitch on hover or focus-within. */
  onHover?: boolean
  /** The two channel colours. */
  colors?: [string, string]
  /** How far the channels separate, in pixels. */
  offset?: number
  /** Element to render. */
  as?: ElementType
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Text that tears into its colour channels for a few frames at a time.
 *
 * Three copies are stacked: a clean one that carries the actual text, and two
 * coloured ghosts offset in opposite directions. The ghosts are `aria-hidden`,
 * so a screen reader hears the line once — stacking three readable copies is
 * the mistake that makes this effect an accessibility problem rather than a
 * decoration.
 *
 * The keyframes spend more than ninety per cent of their time perfectly still.
 * A continuous glitch is noise the eye tunes out in seconds; a clean line that
 * tears twice, briefly, and settles is the thing that actually reads as broken
 * signal.
 *
 * Each burst slices with a different `clip-path` inset, so the tear lands on a
 * different band of the glyphs every time and never looks like the same loop.
 */
export function GlitchText({
  children,
  duration = 4,
  onHover = false,
  colors = ['#ff2e88', '#22e0ff'],
  offset = 2,
  as,
  className,
}: GlitchTextProps) {
  const Component = (as ?? 'span') as ElementType

  const ghost = (animation: string, color: string, direction: number): CSSProperties => ({
    color,
    textShadow: `${direction * offset}px 0 ${color}`,
    animation: `${animation} ${duration}s infinite steps(1, end)`,
  })

  return (
    <Component
      className={cn(
        'relative inline-block',
        onHover && 'group/glitch',
        className,
      )}
    >
      {/* The only copy anyone reads or hears. */}
      <span className="relative z-10">{children}</span>

      <span
        aria-hidden="true"
        className={cn(
          'motion-safe-only absolute inset-0 select-none',
          onHover && 'opacity-0 group-hover/glitch:opacity-70 group-focus-within/glitch:opacity-70',
          !onHover && 'opacity-70',
        )}
        style={ghost('glitch-a', colors[0], -1)}
      >
        {children}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'motion-safe-only absolute inset-0 select-none',
          onHover && 'opacity-0 group-hover/glitch:opacity-70 group-focus-within/glitch:opacity-70',
          !onHover && 'opacity-70',
        )}
        style={ghost('glitch-b', colors[1], 1)}
      >
        {children}
      </span>
    </Component>
  )
}
