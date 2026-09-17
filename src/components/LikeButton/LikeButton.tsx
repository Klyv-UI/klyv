'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { usePrefersReducedMotion } from '../../lib/motion'

export type LikeButtonSize = 'sm' | 'md'

export interface LikeButtonProps {
  /** Whether the reader has liked it, when controlled. */
  liked?: boolean
  /** Starting state, when uncontrolled. */
  defaultLiked?: boolean
  /** The count to show, when controlled. Should already include the reader's own like. */
  count?: number
  /** Starting count, when uncontrolled. */
  defaultCount?: number
  /** Save the change. The button updates at once; a rejected promise puts it back. */
  onLikedChange?: (liked: boolean) => void | Promise<void>
  /** Called with the reason when saving fails and the like is rolled back. */
  onError?: (reason: unknown) => void
  /** Accessible name — "Like", "Favourite". Stays the same whether pressed or not. */
  label?: string
  /** What is being counted, for the description — "likes". */
  countNoun?: string
  /** Hide the count and show the heart alone. */
  hideCount?: boolean
  size?: LikeButtonSize
  /** Merged last, so it wins. */
  className?: string
}

/** 1204 → "1.2k", 1500000 → "1.5M". Small numbers are shown whole. */
function formatLikeCount(value: number): string {
  if (Math.abs(value) < 1000) return String(value)
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value).replace('K', 'k')
}

const BURST = [0, 60, 120, 180, 240, 300]

/**
 * A heart that responds at once and tells the truth later.
 *
 * Waiting for the server before filling the heart makes a like feel broken,
 * so the button flips and counts immediately and calls `onLikedChange`. If
 * that promise rejects, the heart and count go back to what the server still
 * believes and `onError` is told — the reader is not left looking at a like
 * that never saved. A second tap while one is saving is ignored, so the
 * optimistic state and the request cannot cross.
 *
 * It is a toggle button: `aria-pressed` carries the state and the name stays
 * "Like" either way, with the exact count as its description. The count shown
 * is compact (1.2k); the one read out is whole. Liking plays a small burst
 * that is skipped entirely under reduced motion.
 */
export function LikeButton({
  liked: controlledLiked,
  defaultLiked = false,
  count: controlledCount,
  defaultCount = 0,
  onLikedChange,
  onError,
  label = 'Like',
  countNoun = 'likes',
  hideCount = false,
  size = 'md',
  className,
}: LikeButtonProps) {
  const [ownLiked, setOwnLiked] = useState(defaultLiked)
  const [ownCount, setOwnCount] = useState(defaultCount)
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null)
  const heartRef = useRef<SVGSVGElement>(null)
  const burstRef = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()
  const descriptionId = useId()

  const liked = optimistic?.liked ?? controlledLiked ?? ownLiked
  const count = optimistic?.count ?? controlledCount ?? ownCount

  const play = () => {
    if (reduced) return
    heartRef.current?.animate?.(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }],
      { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.4)' },
    )
    burstRef.current?.querySelectorAll<HTMLElement>('[data-dot]').forEach((dot, index) => {
      const angle = (BURST[index] * Math.PI) / 180
      dot.animate?.(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * 14}px), calc(-50% + ${Math.sin(angle) * 14}px)) scale(0)`, opacity: 0 },
        ],
        { duration: 450, easing: 'ease-out' },
      )
    })
  }

  const toggle = async () => {
    if (optimistic) return
    const next = !liked
    const nextCount = Math.max(0, count + (next ? 1 : -1))
    setOptimistic({ liked: next, count: nextCount })
    if (next) play()
    try {
      await onLikedChange?.(next)
      if (controlledLiked === undefined) setOwnLiked(next)
      if (controlledCount === undefined) setOwnCount(nextCount)
    } catch (reason) {
      onError?.(reason)
    } finally {
      setOptimistic(null)
    }
  }

  const glyph = size === 'sm' ? 14 : 16

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={label}
      aria-describedby={hideCount ? undefined : descriptionId}
      onClick={() => void toggle()}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-bold leading-none tabular-nums transition-colors',
        size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3 text-[13px]',
        liked
          ? 'border-transparent bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger'
          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      <span ref={burstRef} className="relative inline-flex" aria-hidden="true">
        <svg ref={heartRef} viewBox="0 0 16 16" width={glyph} height={glyph} className="overflow-visible">
          <path
            d="M8 13.75S2 10.3 2 6.1A3.1 3.1 0 018 4.6a3.1 3.1 0 016 1.5c0 4.2-6 7.65-6 7.65z"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
        </svg>
        {BURST.map((angle) => (
          <span key={angle} data-dot="" className="pointer-events-none absolute left-1/2 top-1/2 size-1 rounded-full bg-current opacity-0" />
        ))}
      </span>
      {!hideCount && (
        <>
          <span aria-hidden="true">{formatLikeCount(count)}</span>
          <span id={descriptionId} className="sr-only">
            {count.toLocaleString('en')} {countNoun}
          </span>
        </>
      )}
    </button>
  )
}
