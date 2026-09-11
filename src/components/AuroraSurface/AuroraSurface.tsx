import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** How far the light bleeds. `soft` stays behind text; `bold` is a hero. */
export type AuroraIntensity = 'soft' | 'medium' | 'bold'

const INTENSITY: Record<AuroraIntensity, { opacity: number; blur: number; scale: number }> = {
  soft: { opacity: 0.4, blur: 70, scale: 0.85 },
  medium: { opacity: 0.62, blur: 58, scale: 1 },
  bold: { opacity: 0.85, blur: 46, scale: 1.2 },
}

/** The three drifting blobs. Each has its own path, so they never sync up. */
const BLOBS = [
  { animation: 'aurora-a', duration: 17, top: '-25%', left: '-15%', size: '70%' },
  { animation: 'aurora-b', duration: 23, top: '-10%', left: '35%', size: '80%' },
  { animation: 'aurora-c', duration: 29, top: '20%', left: '5%', size: '65%' },
]

export interface AuroraSurfaceOwnProps {
  /** Content laid over the aurora. */
  children?: ReactNode
  /** Three colours, one per blob. Defaults to the accent family. */
  colors?: [string, string, string]
  intensity?: AuroraIntensity
  /** Overlay a fine grain so the gradient never bands on wide screens. */
  grain?: boolean
  /** Freeze the blobs where they are. */
  paused?: boolean
  /** Merged last, so it wins. */
  className?: string
  /** Classes for the content layer above the light. */
  contentClassName?: string
}

type AuroraSurfaceProps<E extends ElementType> = AuroraSurfaceOwnProps & {
  /** Element to render. */
  as?: E
} & Omit<ComponentPropsWithoutRef<E>, keyof AuroraSurfaceOwnProps | 'as'>

/**
 * A container lit from behind by three slowly drifting colour fields.
 *
 * The effect is three blurred radial gradients on their own transform loops at
 * co-prime durations, so the composite never visibly repeats. Only `transform`
 * animates — the blur is set once and never recalculated — which is what keeps
 * a full-bleed hero at 60fps where an animated `filter` would not.
 *
 * The light sits in an `aria-hidden` layer under the content and the whole
 * thing clips itself, so it can be dropped behind real UI without changing any
 * of the contrast or focus behaviour above it.
 */
export function AuroraSurface<E extends ElementType = 'div'>({
  as,
  children,
  colors = ['var(--color-accent)', '#7fd4ff', 'var(--color-accent-soft)'],
  intensity = 'medium',
  grain = false,
  paused = false,
  className,
  contentClassName,
  ...rest
}: AuroraSurfaceProps<E>) {
  const Component = (as ?? 'div') as ElementType
  const { opacity, blur, scale } = INTENSITY[intensity]

  return (
    <Component
      className={cn(
        'relative isolate overflow-hidden rounded-[var(--radius-card)] bg-app',
        className,
      )}
      {...rest}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {BLOBS.map((blob, index) => (
          <div
            key={blob.animation}
            className="motion-safe-only absolute rounded-full will-change-transform"
            style={{
              top: blob.top,
              left: blob.left,
              width: `calc(${blob.size} * ${scale})`,
              aspectRatio: '1 / 1',
              background: `radial-gradient(circle at 50% 50%, ${colors[index]} 0%, transparent 68%)`,
              filter: `blur(${blur}px)`,
              opacity,
              animation: `${blob.animation} ${blob.duration}s ease-in-out infinite`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        ))}
        {grain && (
          <div
            className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
            }}
          />
        )}
      </div>

      <div className={cn('relative', contentClassName)}>{children}</div>
    </Component>
  )
}
