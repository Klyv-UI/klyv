'use client'

import { useState } from 'react'
import { cn } from '../../lib/cn'

export type VoteButtonsVote = 'up' | 'down' | null
export type VoteButtonsOrientation = 'vertical' | 'horizontal'
export type VoteButtonsSize = 'sm' | 'md'

export interface VoteButtonsProps {
  /** The reader’s vote, when controlled. */
  vote?: VoteButtonsVote
  /** Starting vote when uncontrolled. */
  defaultVote?: VoteButtonsVote
  /** The score, when controlled. Should already include the reader’s own vote. */
  score?: number
  /** Starting score when uncontrolled. */
  defaultScore?: number
  /** Save the vote. The buttons update at once; a rejected promise puts them back. */
  onVoteChange?: (vote: VoteButtonsVote) => void | Promise<void>
  /** Called with the reason when saving fails and the vote is rolled back. */
  onError?: (reason: unknown) => void
  /** What is being voted on, for the accessible names — "answer" gives "Upvote answer". */
  subject?: string
  /** vertical is the Stack Overflow column; horizontal the inline row under a comment. */
  orientation?: VoteButtonsOrientation
  size?: VoteButtonsSize
  /** Blocks voting — your own post, a locked thread. */
  disabled?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const WEIGHT = { up: 1, down: -1 } as const
const weight = (vote: VoteButtonsVote) => (vote ? WEIGHT[vote] : 0)

const Arrow = ({ up, filled, size }: { up: boolean; filled: boolean; size: number }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M8 2.25l5.25 6H10.5v5.5h-5v-5.5H2.75z' : 'M8 13.75l5.25-6H10.5v-5.5h-5v5.5H2.75z'} />
  </svg>
)

/**
 * Up, down, and the score between them.
 *
 * Both arrows are toggle buttons with `aria-pressed`, so the state is heard
 * as well as seen, and pressing the lit one again takes the vote back.
 * Pressing the other one switches in a single step, moving the score by two,
 * as readers of every forum expect.
 *
 * The vote lands at once and saves behind it. If the save fails the arrows
 * and score return to what the server still holds and `onError` hears why —
 * a vote that looked counted but never was is worse than a visible failure.
 * Presses while one is saving are ignored, so an optimistic state and a
 * request can never cross. The score is a polite live region: it changes as a
 * result of the press, and hearing the new number confirms it.
 */
export function VoteButtons({
  vote: controlledVote,
  defaultVote = null,
  score: controlledScore,
  defaultScore = 0,
  onVoteChange,
  onError,
  subject,
  orientation = 'vertical',
  size = 'md',
  disabled = false,
  className,
}: VoteButtonsProps) {
  const [ownVote, setOwnVote] = useState<VoteButtonsVote>(defaultVote)
  const [ownScore, setOwnScore] = useState(defaultScore)
  const [optimistic, setOptimistic] = useState<{ vote: VoteButtonsVote; score: number } | null>(null)

  const vote = optimistic ? optimistic.vote : controlledVote !== undefined ? controlledVote : ownVote
  const score = optimistic?.score ?? controlledScore ?? ownScore

  const press = async (direction: 'up' | 'down') => {
    if (optimistic || disabled) return
    const next: VoteButtonsVote = vote === direction ? null : direction
    const nextScore = score - weight(vote) + weight(next)
    setOptimistic({ vote: next, score: nextScore })
    try {
      await onVoteChange?.(next)
      if (controlledVote === undefined) setOwnVote(next)
      if (controlledScore === undefined) setOwnScore(nextScore)
    } catch (reason) {
      onError?.(reason)
    } finally {
      setOptimistic(null)
    }
  }

  const vertical = orientation === 'vertical'
  const glyph = size === 'sm' ? 14 : 16
  const button = (direction: 'up' | 'down') => {
    const on = vote === direction
    const word = direction === 'up' ? 'Upvote' : 'Downvote'
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={subject ? `${word} ${subject}` : word}
        disabled={disabled}
        onClick={() => void press(direction)}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40',
          size === 'sm' ? 'size-7' : 'size-9',
          on
            ? direction === 'up'
              ? 'bg-[color-mix(in_oklab,var(--color-accent)_22%,transparent)] text-ink'
              : 'bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)] text-danger'
            : 'text-ink-faint hover:bg-surface-muted hover:text-ink',
        )}
      >
        <Arrow up={direction === 'up'} filled={on} size={glyph} />
      </button>
    )
  }

  return (
    <div
      role="group"
      aria-label={subject ? `Votes on ${subject}` : 'Votes'}
      aria-busy={optimistic ? true : undefined}
      className={cn('inline-flex items-center', vertical ? 'flex-col gap-0.5' : 'flex-row gap-1', className)}
    >
      {button('up')}
      <span
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'min-w-[2ch] text-center font-extrabold tabular-nums leading-none',
          size === 'sm' ? 'text-[12px]' : 'text-[14px]',
          vote === 'up' ? 'text-ink' : vote === 'down' ? 'text-danger' : 'text-ink-soft',
        )}
      >
        <span className="sr-only">Score </span>
        {score.toLocaleString()}
      </span>
      {button('down')}
    </div>
  )
}
