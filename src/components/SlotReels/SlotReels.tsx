'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface SlotReelsProps {
  /** What can land. Any short strings — emoji read best. */
  symbols: string[]
  /** How many reels. */
  reels?: number
  /** Force a result. Omit and it picks one at random. */
  result?: number[]
  /** Called once every reel has stopped. */
  onSettle?: (result: number[]) => void
  /** Milliseconds the first reel spins. Each later one adds `stagger`. */
  duration?: number
  /** Milliseconds between one reel stopping and the next. */
  stagger?: number
  /** Row height in pixels. */
  size?: number
  /** Merged last, so it wins. */
  className?: string
}

/**
 * Reels that spin up, blur, and stop one after another.
 *
 * Each reel is a tall strip of symbols translated upwards, and the strip
 * contains several repeats of the set so it can travel a long way before
 * landing. Landing is just the strip's final offset — the result is chosen
 * first and the distance is computed to arrive at it, rather than the symbol
 * being read off wherever the animation happened to stop.
 *
 * Reels stop left to right with a stagger, which is the entire drama of a slot
 * machine: two matching symbols and one still spinning is a completely
 * different feeling from three landing at once.
 *
 * The blur is applied while moving and removed on the last leg, because a
 * symbol that arrives already sharp reads as a jump cut. It is a CSS filter on
 * the strip, so it costs nothing per frame.
 */
export function SlotReels({
  symbols,
  reels = 3,
  result,
  onSettle,
  duration = 1200,
  stagger = 320,
  size = 84,
  className,
}: SlotReelsProps) {
  const REPEATS = 8
  const [offsets, setOffsets] = useState<number[]>(() => Array.from({ length: reels }, () => 0))
  const [landed, setLanded] = useState<number[]>(() => Array.from({ length: reels }, () => 0))
  const [spinning, setSpinning] = useState<boolean[]>(() => Array.from({ length: reels }, () => false))
  const timers = useRef<number[]>([])
  const cycle = useRef(0)

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer)
    },
    [],
  )

  const spin = () => {
    if (spinning.some(Boolean)) return
    // The result is decided first; the distance is computed to reach it.
    const target =
      result ?? Array.from({ length: reels }, () => Math.floor(Math.random() * symbols.length))

    cycle.current += 1
    const lap = cycle.current

    setLanded(target)
    setSpinning(Array.from({ length: reels }, () => true))
    setOffsets(
      target.map((index, reel) => (lap * REPEATS - reel) * symbols.length * size + index * size),
    )

    timers.current = target.map((_, reel) =>
      window.setTimeout(
        () => {
          setSpinning((current) => current.map((value, i) => (i === reel ? false : value)))
          if (reel === reels - 1) onSettle?.(target)
        },
        duration + reel * stagger,
      ),
    )
  }

  const strip = Array.from({ length: REPEATS * (cycle.current + 2) }, (_, index) => symbols[index % symbols.length])
  const busy = spinning.some(Boolean)

  return (
    <div className={cn('flex flex-col items-start gap-4', className)}>
      <div className="flex gap-2 rounded-[var(--radius-card)] border border-line bg-ink p-3">
        {Array.from({ length: reels }, (_, reel) => (
          <div
            key={reel}
            className="relative overflow-hidden rounded-[var(--radius-tile)] bg-white"
            style={{ width: size, height: size }}
          >
            <div
              className="motion-safe-only absolute inset-x-0 top-0"
              style={{
                transform: `translateY(-${offsets[reel] ?? 0}px)`,
                transition: `transform ${duration + reel * stagger}ms cubic-bezier(0.16, 0.9, 0.2, 1)`,
                // Removed on the last leg: a symbol arriving sharp is a jump cut.
                filter: spinning[reel] ? 'blur(3px)' : 'none',
              }}
            >
              {strip.map((symbol, index) => (
                <span
                  key={index}
                  className="grid place-items-center"
                  style={{ height: size, fontSize: size * 0.5 }}
                >
                  {symbol}
                </span>
              ))}
            </div>

            {/* A shade top and bottom, so the window reads as a window. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.16), transparent 28%, transparent 72%, rgba(0,0,0,0.16))',
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={spin}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? 'Spinning…' : 'Spin'}
        </button>
        <Text as="span" size="body">
          {busy ? '—' : landed.map((index) => symbols[index]).join(' ')}
        </Text>
      </div>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {busy ? 'Reels spinning' : `Landed on ${landed.map((index) => symbols[index]).join(', ')}`}
        </p>
      </VisuallyHidden>
    </div>
  )
}
