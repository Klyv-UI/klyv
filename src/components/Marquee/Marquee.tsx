import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface MarqueeProps {
  /** Content to scroll. It is duplicated to make the loop seamless. */
  children: ReactNode
  /** Seconds for one full pass. Higher is slower. */
  speed?: number
  /** Pause while the pointer is over the strip. */
  pauseOnHover?: boolean
  /** Fade the leading and trailing edges. */
  fade?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Infinite horizontal scroller. The content is rendered twice so the loop has
 * no visible seam; the duplicate is hidden from assistive tech.
 *
 * It stops entirely under `prefers-reduced-motion`, which is a requirement for
 * continuous motion, not a nicety.
 */
export function Marquee({
  children,
  speed = 20,
  pauseOnHover = true,
  fade = true,
  className,
}: MarqueeProps) {
  return (
    <div
      className={cn('group relative flex overflow-hidden', className)}
      style={
        fade
          ? {
              maskImage:
                'linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent, #000 48px, #000 calc(100% - 48px), transparent)',
            }
          : undefined
      }
    >
      <div
        className={cn(
          'motion-safe-only flex w-max shrink-0 animate-[marquee_linear_infinite]',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}
