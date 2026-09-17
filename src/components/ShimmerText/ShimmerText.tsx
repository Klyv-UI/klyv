import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ShimmerTextTone = 'ink' | 'accent'

export interface ShimmerTextOwnProps {
  /** The label. Plain text reads best; the sweep is painted across every glyph. */
  children: ReactNode
  /** `ink` sweeps a darker band across soft ink; `accent` sweeps the accent across it. */
  tone?: ShimmerTextTone
  /** Seconds for one sweep across the text. */
  speed?: number
  /** Stop the sweep and show the text plainly — when the work it labels is finished. */
  paused?: boolean
  /** Merged last, so it wins. */
  className?: string
}

export type ShimmerTextProps<E extends ElementType = 'span'> = ShimmerTextOwnProps & {
  /** Render as another element — a `p`, a heading. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof ShimmerTextOwnProps | 'as'>

const TONES: Record<ShimmerTextTone, string> = {
  ink: 'bg-[linear-gradient(100deg,var(--color-ink-faint)_35%,var(--color-ink)_50%,var(--color-ink-faint)_65%)]',
  accent:
    'bg-[linear-gradient(100deg,var(--color-ink-faint)_35%,color-mix(in_oklab,var(--color-accent-strong)_70%,var(--color-ink))_50%,var(--color-ink-faint)_65%)]',
}

/**
 * A label with a band of light passing across it — “Thinking…”, “Generating
 * summary”, “Searching 12 sources”.
 *
 * A spinner beside a label says the same thing twice and takes a second
 * element to do it. Here the text itself carries the activity, so the label and
 * the busy state cannot drift apart. The glyphs are a window onto a moving
 * gradient (`background-clip: text`), which keeps it real, selectable text that
 * a screen reader reads once, with no duplicate layer.
 *
 * Every stop in the gradient is an ink token, so both ends stay readable on
 * the surface in either theme: the sweep changes emphasis, never legibility.
 * Under reduced motion, in forced colours, or when paused, it is plain soft
 * ink with no gradient at all.
 */
export function ShimmerText<E extends ElementType = 'span'>({
  as,
  children,
  tone = 'ink',
  speed = 2,
  paused = false,
  className,
  style,
  ...props
}: ShimmerTextProps<E>) {
  const Component = (as ?? 'span') as ElementType

  if (paused) {
    return (
      <Component className={cn('text-ink-soft', className)} style={style} {...props}>
        {children}
      </Component>
    )
  }

  return (
    <Component
      className={cn(
        'motion-safe-only bg-[length:200%_100%] bg-clip-text text-transparent',
        TONES[tone],
        'motion-reduce:bg-none motion-reduce:text-ink-soft forced-colors:bg-none forced-colors:text-[CanvasText]',
        className,
      )}
      style={{
        // Reversed, so the band travels the way the text is read.
        animation: `gradient-pan ${Math.max(0.2, speed)}s linear infinite reverse`,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  )
}
