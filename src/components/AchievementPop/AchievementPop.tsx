'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { Portal } from '../Portal'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic'

const TIERS: Record<AchievementTier, { plate: string; ring: string; word: string }> = {
  bronze: { plate: 'linear-gradient(140deg,#e8b48a,#b9784a)', ring: '#b9784a', word: 'Bronze' },
  silver: { plate: 'linear-gradient(140deg,#eef1f3,#adb6bd)', ring: '#adb6bd', word: 'Silver' },
  gold: { plate: 'linear-gradient(140deg,#ffe9a8,#e2a930)', ring: '#e2a930', word: 'Gold' },
  mythic: {
    plate: 'linear-gradient(140deg,#ff5f6d,#7fd4ff 45%,#c8f24e)',
    ring: '#b06ab3',
    word: 'Mythic',
  },
}

export interface AchievementPopProps {
  /** Shown while true, then dismissed. */
  open: boolean
  onClose: () => void
  /** What was achieved. */
  title: string
  /** One line of detail under the title. */
  description?: string
  tier?: AchievementTier
  /** The glyph on the plate. An emoji, a letter, an icon. */
  glyph?: ReactNode
  /** Milliseconds before it leaves on its own. 0 waits for a click. */
  duration?: number
  /** Where it comes from. */
  position?: 'top' | 'bottom'
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The badge that drops in, shines, and leaves.
 *
 * The plate scales past its resting size and settles back — 0.4 to 1.12 to 1 —
 * because an overshoot is what makes an arrival feel like an arrival. Easing
 * cleanly to 1 is technically smoother and reads as a panel appearing.
 *
 * The shine is a separate sweep that runs *after* the plate lands, not with it.
 * Overlapping them wastes both: the eye is still tracking the entrance and
 * never sees the light cross the metal.
 *
 * It announces itself assertively, which is the rare correct use of that — an
 * achievement is unsolicited, brief, and gone before a polite queue would have
 * reached it. And it is dismissible, because a reward that cannot be closed is
 * a modal wearing a party hat.
 */
export function AchievementPop({
  open,
  onClose,
  title,
  description,
  tier = 'gold',
  glyph = '★',
  duration = 4200,
  position = 'top',
  className,
}: AchievementPopProps) {
  const [shine, setShine] = useState(false)
  const palette = TIERS[tier]

  useEffect(() => {
    if (!open) {
      setShine(false)
      return
    }
    // After the landing, never during it.
    const start = window.setTimeout(() => setShine(true), 520)
    const stop = duration > 0 ? window.setTimeout(onClose, duration) : undefined
    return () => {
      window.clearTimeout(start)
      if (stop) window.clearTimeout(stop)
    }
  }, [duration, onClose, open])

  if (!open) return null

  return (
    <Portal>
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 z-[var(--z-overlay)] flex justify-center px-4',
          position === 'top' ? 'top-6' : 'bottom-6',
        )}
      >
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            'motion-safe-only pointer-events-auto relative flex items-center gap-3.5 overflow-hidden rounded-[var(--radius-banner)] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-window)]',
            className,
          )}
          style={{ animation: 'badge-pop 620ms cubic-bezier(0.32, 0.72, 0, 1) both' }}
        >
          <span
            className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-[20px]"
            style={{ background: palette.plate, boxShadow: `0 0 0 3px ${palette.ring}33` }}
          >
            <span aria-hidden="true">{glyph}</span>

            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                aria-hidden="true"
                className="motion-safe-only absolute text-[10px] text-white"
                style={
                  {
                    left: `${[8, 74, 20, 82][index]}%`,
                    top: `${[6, 18, 78, 66][index]}%`,
                    animation: `sparkle-twinkle 1.6s ease-in-out ${index * 0.25}s infinite`,
                  } as CSSProperties
                }
              >
                ✦
              </span>
            ))}
          </span>

          <span className="flex min-w-0 flex-col">
            <Text as="span" size="micro" tone="faint" className="uppercase tracking-[0.16em]">
              {palette.word} unlocked
            </Text>
            <Text as="span" size="heading" truncate>
              {title}
            </Text>
            {description && (
              <Text as="span" size="caption" tone="soft" truncate>
                {description}
              </Text>
            )}
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="ml-1 shrink-0 rounded-full px-1 text-[11px] font-bold text-ink-faint transition-colors hover:text-ink"
          >
            ✕
          </button>

          {/* Runs after the landing. Overlapping them wastes both. */}
          {shine && (
            <span
              aria-hidden="true"
              className="motion-safe-only pointer-events-none absolute inset-y-0 w-1/3 bg-white/60 blur-[6px]"
              style={{ animation: 'shimmer-sweep 1.1s ease-in-out 1' }}
            />
          )}
        </div>
      </div>
    </Portal>
  )
}
