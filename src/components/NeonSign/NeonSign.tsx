import type { CSSProperties, ElementType, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface NeonSignProps {
  /** The text to light. */
  children: ReactNode
  /** Tube colour. Anything CSS accepts. */
  color?: string
  /** Flicker like a tube that has seen some nights. */
  flicker?: boolean
  /** Off — dark glass tube, no glow. For a sign that turns on. */
  off?: boolean
  /** Outline only, as real neon is. Solid fills the glyphs instead. */
  outline?: boolean
  /** Element for the text. */
  as?: ElementType
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Text as a neon tube, with the buzz.
 *
 * Neon is three stacked glows at different radii, not one big blur: a tight
 * core that keeps the letterform readable, a mid halo, and a wide bloom that
 * bleeds into whatever is behind it. One large shadow gives you a smudge; three
 * give you a tube.
 *
 * The flicker is deliberately uneven and mostly *off* — a sign that blinks on a
 * steady beat reads as a CSS animation. Real tubes stutter twice in a row, then
 * hold for a while, so the keyframe clusters its dropouts and leaves long
 * stretches lit.
 *
 * Turned off, the glyphs become dark glass with a faint inner line rather than
 * disappearing — which is what makes switching a sign on feel like switching
 * something on.
 */
export function NeonSign({
  children,
  color = '#ff4fd8',
  flicker = true,
  off = false,
  outline = true,
  as,
  className,
}: NeonSignProps) {
  const Component = (as ?? 'span') as ElementType

  if (off) {
    return (
      <Component
        className={cn('inline-block font-extrabold tracking-[-0.02em]', className)}
        style={
          {
            color: 'transparent',
            WebkitTextStroke: '1.5px rgba(255,255,255,0.16)',
            textShadow: '0 1px 0 rgba(0,0,0,0.6)',
          } as CSSProperties
        }
      >
        {children}
      </Component>
    )
  }

  return (
    <Component
      className={cn(
        'motion-safe-only inline-block font-extrabold tracking-[-0.02em]',
        className,
      )}
      style={
        {
          color,
          WebkitTextStroke: outline ? '1.25px currentColor' : undefined,
          // Three radii: core, halo, bloom. One shadow would be a smudge.
          textShadow: outline
            ? `0 0 4px ${color}, 0 0 14px ${color}, 0 0 42px ${color}`
            : `0 0 6px ${color}, 0 0 18px ${color}, 0 0 56px ${color}`,
          WebkitTextFillColor: outline ? 'transparent' : color,
          animation: flicker ? 'neon-flicker 6s infinite' : undefined,
        } as CSSProperties
      }
    >
      {children}
    </Component>
  )
}
