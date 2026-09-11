'use client'

import { cn } from '../../lib/cn'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'

export interface PollOption {
  id: string
  label: string
  /** Sits on the bar. An emoji does more work than an icon here. */
  emoji?: string
  votes: number
}

export interface VibePollProps {
  /** What is being asked. Becomes the group label. */
  question: string
  options: PollOption[]
  /** The option this person picked, if any. */
  value?: string | null
  onVote: (id: string) => void
  /** Show the split before voting. Off is the honest default. */
  revealBeforeVote?: boolean
  /** Copy under the bars. */
  footnote?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * A poll where the bars grow out of the options themselves.
 *
 * Results stay hidden until this person has voted, which is the difference
 * between a poll and a popularity feedback loop. Showing the split first makes
 * most people pick the winning side, and the result stops meaning anything —
 * `revealBeforeVote` exists for the cases where that is genuinely fine, and is
 * off by default because usually it is not.
 *
 * Each row *is* its bar: the fill is a background inside the button rather than
 * a separate element underneath. That is what lets the label sit on the fill
 * and stay legible as the bar grows past it, instead of the usual arrangement
 * where a bar creeps up behind text it cannot see.
 *
 * The percentage counts up while the bar grows, so the number and the length
 * are telling the same story at the same speed.
 */
export function VibePoll({
  question,
  options,
  value,
  onVote,
  revealBeforeVote = false,
  footnote,
  className,
}: VibePollProps) {
  const voted = Boolean(value)
  const reveal = voted || revealBeforeVote
  const total = options.reduce((sum, option) => sum + option.votes, 0)
  const leader = options.reduce(
    (best, option) => (option.votes > best.votes ? option : best),
    options[0],
  )

  return (
    <div role="group" aria-label={question} className={cn('flex flex-col gap-3', className)}>
      <Text size="heading" leading="normal">
        {question}
      </Text>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const share = total === 0 ? 0 : option.votes / total
          const picked = value === option.id
          const winning = reveal && option.id === leader?.id && total > 0

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={picked}
              onClick={() => onVote(option.id)}
              className={cn(
                'relative isolate flex items-center gap-3 overflow-hidden rounded-[var(--radius-tile)] border px-3.5 py-3 text-left transition-[border-color,transform] duration-[var(--duration-fast)] active:scale-[0.99]',
                picked
                  ? 'border-accent-strong'
                  : 'border-line hover:border-line-strong',
              )}
            >
              {/* The row is the bar. Nothing hides behind the label. */}
              <span
                aria-hidden="true"
                className={cn(
                  'motion-safe-only absolute inset-y-0 left-0 -z-10 origin-left transition-transform duration-[700ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
                  winning ? 'bg-accent' : 'bg-surface-muted',
                )}
                style={{ width: '100%', transform: `scaleX(${reveal ? share : 0})` }}
              />

              {option.emoji && (
                <span aria-hidden="true" className="text-[17px]">
                  {option.emoji}
                </span>
              )}

              <Text as="span" size="body" className="min-w-0 flex-1" truncate>
                {option.label}
              </Text>

              {reveal && (
                <Text as="span" size="caption" weight="bold" tabular>
                  {Math.round(share * 100)}%
                </Text>
              )}

              {picked && (
                <Text as="span" size="micro" tone="faint">
                  your pick
                </Text>
              )}
            </button>
          )
        })}
      </div>

      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {reveal
          ? `${total.toLocaleString()} ${total === 1 ? 'vote' : 'votes'}${footnote ? ` · ${footnote}` : ''}`
          : 'Vote to see the split.'}
      </Text>

      {reveal && (
        <VisuallyHidden>
          <ul>
            {options.map((option) => (
              <li key={option.id}>
                {option.label}: {option.votes} votes,{' '}
                {total === 0 ? 0 : Math.round((option.votes / total) * 100)} per cent
              </li>
            ))}
          </ul>
        </VisuallyHidden>
      )}
    </div>
  )
}
