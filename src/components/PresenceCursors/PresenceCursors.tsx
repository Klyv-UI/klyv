import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface RemoteCursor {
  id: string
  name: string
  /** Position as a fraction of the surface, 0 to 1, so it survives a resize. */
  x: number
  y: number
  color?: string
  /** What they are doing — shown beside the name while it is set. */
  status?: string
}

export interface PresenceCursorsProps {
  cursors: RemoteCursor[]
  /** Accessible name for the layer. */
  label: string
  /** Milliseconds to glide between two reported positions. */
  smoothing?: number
  showLabels?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const FALLBACK = ['#7fd4ff', 'var(--color-accent-strong)', '#f5a524', '#e5484d', '#3f9b4a']

/**
 * Other people's pointers, drawn over a shared surface.
 *
 * Positions arrive at whatever rate the network manages — usually ten or
 * twenty a second, often unevenly. Rendering each one where it lands produces
 * visible teleporting, so each cursor carries a CSS transition slightly longer
 * than the expected gap between updates and glides from the last position to
 * the next. The interpolation is the browser's, costs nothing per frame, and
 * turns a sparse feed into continuous movement.
 *
 * Coordinates are fractions rather than pixels, because two people looking at
 * the same document through different window sizes still have to agree where
 * a pointer is. Each cursor is therefore a full-size layer moved by a
 * *percentage* transform — a percentage translate resolves against the
 * element's own box, so a full-size box makes `50%` mean half the surface with
 * nothing measured and nothing to recompute on resize.
 *
 * The layer is `pointer-events: none` and `aria-hidden`: presence is ambient,
 * and a remote pointer must never intercept a local click. Who is here belongs
 * in `PresenceBar`, which announces it properly.
 */
export function PresenceCursors({
  cursors,
  label,
  smoothing = 120,
  showLabels = true,
  className,
}: PresenceCursorsProps) {
  return (
    <div
      aria-hidden="true"
      data-presence={label}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {cursors.map((cursor, index) => {
        const color = cursor.color ?? FALLBACK[index % FALLBACK.length]
        return (
          <div
            key={cursor.id}
            className="motion-safe-only absolute inset-0 will-change-transform"
            style={{
              transform: `translate(${cursor.x * 100}%, ${cursor.y * 100}%)`,
              transition: `transform ${smoothing}ms linear`,
            }}
          >
            <div className="absolute left-0 top-0 flex items-start">
              <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden="true">
                <path
                  d="M1 1.4 15.2 9.6l-6.1 1.1L6 17.2 1 1.4Z"
                  fill={color}
                  stroke="white"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>

              {showLabels && (
                <div
                  className="ml-0.5 mt-2 inline-flex max-w-[180px] items-center gap-1.5 rounded-full px-2 py-1"
                  style={{ background: color }}
                >
                  <Text as="span" size="micro" truncate className="text-white">
                    {cursor.name}
                  </Text>
                  {cursor.status && (
                    <Text as="span" size="micro" weight="medium" truncate className="text-white/80">
                      {cursor.status}
                    </Text>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
