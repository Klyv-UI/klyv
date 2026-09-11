'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { cn } from '../../lib/cn'
import { Text } from '../Text'

export interface Reaction {
  id: string
  /** The glyph. An emoji, or any short string. */
  emoji: string
  /** What it means — this is what a screen reader announces. */
  label: string
  count: number
}

export interface ReactionBarProps {
  reactions: Reaction[]
  /** The reaction the current person has picked, if any. */
  value?: string | null
  /** Picking the current one again clears it — this reports null for that. */
  onChange: (id: string | null) => void
  /** Accessible name for the group. */
  label: string
  /** Particles thrown on pick. 0 turns the burst off. */
  particles?: number
  size?: 'sm' | 'md'
  /** Merged last, so it wins. */
  className?: string
}

interface Burst {
  key: number
  reactionId: string
  emoji: string
  drift: number
  delay: number
}

/**
 * A row of reactions with counts, and a small burst when one is picked.
 *
 * Picking is a toggle, not an increment: the caller owns the counts and is told
 * which reaction this person now holds, or `null` when they take it back. That
 * is the difference between a reaction and a vote counter, and getting it wrong
 * is what produces the familiar bug where a double-tap leaves you two likes.
 *
 * The burst is a handful of absolutely positioned copies of the glyph on one
 * keyframe with a per-particle drift and delay, removed by a timeout once they
 * have finished. It is `aria-hidden` and additive — the count beside it changes
 * whether or not anything animated, so nothing about the state lives only in
 * the particles.
 *
 * Each reaction is a real toggle button with `aria-pressed` and its own label,
 * so the row is understandable without seeing a single glyph.
 */
export function ReactionBar({
  reactions,
  value,
  onChange,
  label,
  particles = 7,
  size = 'md',
  className,
}: ReactionBarProps) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const nextKey = useRef(0)

  const pick = (reaction: Reaction) => {
    const clearing = value === reaction.id
    onChange(clearing ? null : reaction.id)
    if (clearing || particles <= 0) return

    const batch: Burst[] = Array.from({ length: particles }, () => ({
      key: nextKey.current++,
      reactionId: reaction.id,
      emoji: reaction.emoji,
      // Spread sideways, so they do not leave in a single column.
      drift: Math.round((Math.random() - 0.5) * 64),
      delay: Math.random() * 120,
    }))
    setBursts((previous) => [...previous, ...batch])
    const keys = new Set(batch.map((particle) => particle.key))
    window.setTimeout(
      () => setBursts((previous) => previous.filter((particle) => !keys.has(particle.key))),
      1100,
    )
  }

  const compact = size === 'sm'

  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {reactions.map((reaction) => {
        const picked = value === reaction.id
        return (
          <span key={reaction.id} className="relative inline-flex">
            <button
              type="button"
              aria-pressed={picked}
              aria-label={`${reaction.label}, ${reaction.count}`}
              onClick={() => pick(reaction)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border transition-[background-color,border-color,transform] duration-[var(--duration-fast)] active:scale-95',
                compact ? 'h-7 px-2.5' : 'h-8 px-3',
                picked
                  ? 'border-accent-strong bg-accent-soft'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted',
              )}
            >
              <span aria-hidden="true" className={compact ? 'text-[13px]' : 'text-[15px]'}>
                {reaction.emoji}
              </span>
              <Text as="span" size={compact ? 'micro' : 'caption'} weight="bold" tabular>
                {reaction.count}
              </Text>
            </button>

            {bursts
              .filter((particle) => particle.reactionId === reaction.id)
              .map((particle) => (
                <span
                  key={particle.key}
                  aria-hidden="true"
                  className="motion-safe-only pointer-events-none absolute left-1/2 top-0 text-[15px]"
                  style={
                    {
                      '--burst-drift': `${particle.drift}px`,
                      animation: `reaction-float 900ms ease-out ${particle.delay}ms forwards`,
                      opacity: 0,
                    } as CSSProperties
                  }
                >
                  {particle.emoji}
                </span>
              ))}
          </span>
        )
      })}
    </div>
  )
}
