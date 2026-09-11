import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface GradientTextOwnProps {
  /** The text. It stays selectable and searchable. */
  children: ReactNode
  /** Two or more colours. They are repeated to make the loop seamless. */
  colors?: string[]
  /** Seconds for one pass. Ignored when `animate` is false. */
  duration?: number
  animate?: boolean
  /** Angle of the sweep in degrees. */
  angle?: number
  /** A soft coloured halo under the text, for a dark or busy background. */
  glow?: boolean
  /** Merged last, so it wins. */
  className?: string
}

type GradientTextProps<E extends ElementType> = GradientTextOwnProps & {
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof GradientTextOwnProps | 'as'>

/**
 * Text painted with a gradient that slides across it.
 *
 * The gradient is duplicated end to end and the background sized to 200%, so
 * animating `background-position` from 0 to 200% lands exactly where it
 * started — the loop has no seam and needs no reverse leg.
 *
 * `background-clip: text` makes the glyphs a window onto the gradient, which
 * means the text is still text: selectable, searchable, and read normally by a
 * screen reader. The `glow` layer is a blurred, aria-hidden duplicate rather
 * than a text-shadow, because a shadow on clipped text paints over the fill.
 */
export function GradientText<E extends ElementType = 'span'>({
  as,
  children,
  colors = ['#7fd4ff', 'var(--color-accent-strong)', '#b6f09c', '#7fd4ff'],
  duration = 5,
  animate = true,
  angle = 90,
  glow = false,
  className,
  ...rest
}: GradientTextProps<E>) {
  const Component = (as ?? 'span') as ElementType
  const stops = colors.join(', ')
  const paint: CSSProperties = {
    backgroundImage: `linear-gradient(${angle}deg, ${stops}, ${stops})`,
    backgroundSize: '200% auto',
    backgroundPosition: '0% center',
    animation: animate ? `gradient-pan ${duration}s linear infinite` : undefined,
  }

  return (
    <span className={cn('relative inline-block', glow && 'isolate')}>
      {glow && (
        <span
          aria-hidden="true"
          // select-none keeps the duplicate out of a selection: without it,
          // copying the heading yields the text twice.
          className={cn(
            'motion-safe-only pointer-events-none absolute inset-0 -z-10 select-none bg-clip-text text-transparent blur-[14px]',
            className,
          )}
          style={paint}
        >
          {children}
        </span>
      )}
      <Component
        className={cn('motion-safe-only bg-clip-text text-transparent', className)}
        style={paint}
        {...rest}
      >
        {children}
      </Component>
    </span>
  )
}
