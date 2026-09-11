import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface OrbitItem {
  id: string
  /** What sits on the ring — usually an icon tile or an avatar. */
  node: ReactNode
  /** Accessible description, since the ring itself carries no text. */
  label: string
}

export interface OrbitRingProps {
  /** One entry per position on the ring, spaced evenly. */
  items: OrbitItem[]
  /** Accessible name for the whole diagram. */
  label: string
  /** What sits in the middle. */
  children?: ReactNode
  /** Ring radius in pixels. */
  radius?: number
  /** Seconds for one full revolution. */
  duration?: number
  /** Turn the other way — use it to make a second ring read as separate. */
  reverse?: boolean
  /** Degrees to start from. Offsets a second ring so items never line up. */
  offset?: number
  /** Stop while the diagram is hovered or focused, so items can be read. */
  pauseOnHover?: boolean
  /** Draw the path the items travel. */
  showPath?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Items travelling on a circle around a centre.
 *
 * Each item counter-rotates at exactly the ring's rate, so it stays upright
 * while its position goes round. Without that, logos arrive upside down at the
 * bottom of the orbit — which is the single thing that makes this pattern look
 * broken rather than deliberate.
 *
 * Two CSS animations do all of it, on the ring and on each item, so the browser
 * never asks JavaScript for a frame. Rings can be nested by rendering one
 * inside another's `children` with a different radius, duration and `reverse`.
 *
 * The ring is decorative motion around real content: the items are listed to
 * assistive technology in DOM order, and `pauseOnHover` stops the movement so
 * anything on the ring can actually be read and clicked.
 */
export function OrbitRing({
  items,
  label,
  children,
  radius = 120,
  duration = 26,
  reverse = false,
  offset = 0,
  pauseOnHover = true,
  showPath = true,
  className,
}: OrbitRingProps) {
  const size = radius * 2
  const direction: CSSProperties = { animationDirection: reverse ? 'reverse' : 'normal' }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'relative grid place-items-center',
        pauseOnHover && 'group/orbit',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showPath && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-dashed border-line-strong"
        />
      )}

      <div
        aria-hidden="true"
        className={cn(
          'motion-safe-only absolute inset-0',
          pauseOnHover &&
            'group-hover/orbit:[animation-play-state:paused] group-focus-within/orbit:[animation-play-state:paused]',
        )}
        style={{ ...direction, animation: `orbit-spin ${duration}s linear infinite` }}
      >
        {items.map((item, index) => {
          const angle = (offset + (360 / items.length) * index) * (Math.PI / 180)
          return (
            <span
              key={item.id}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
              }}
            >
              {/* Counter-rotation at the ring's own rate keeps this upright. */}
              <span
                className={cn(
                  'motion-safe-only block',
                  pauseOnHover &&
                    'group-hover/orbit:[animation-play-state:paused] group-focus-within/orbit:[animation-play-state:paused]',
                )}
                style={{
                  ...direction,
                  animation: `orbit-counter ${duration}s linear infinite`,
                }}
              >
                {item.node}
              </span>
            </span>
          )
        })}
      </div>

      <div className="relative z-10">{children}</div>

      {/* The ring is decoration; this is what the items actually are. */}
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </div>
  )
}
