'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { countdown } from '../../lib/time'

export type QueuedState = 'waiting' | 'sending' | 'failed'

export interface QueuedChange {
  id: string
  /** What the change was, in the reader's words — not the endpoint name. */
  label: string
  detail?: string
  state: QueuedState
  /** How many times it has already been tried. */
  attempts?: number
  /** Seconds until the next automatic attempt. Counts down locally. */
  nextAttemptIn?: number
  /** Why the last attempt failed. Shown verbatim, so make it readable. */
  error?: string
  /** Nothing more will be tried automatically — it needs a decision. */
  terminal?: boolean
}

export interface RetryQueueProps {
  items: QueuedChange[]
  /** Accessible name for the list. */
  label: string
  onRetry?: (id: string) => void
  onDiscard?: (id: string) => void
  onRetryAll?: () => void
  /** Copy for the empty case — the normal state, and worth stating. */
  emptyLabel?: string
  /** Merged last, so it wins. */
  className?: string
}

const TONE: Record<QueuedState, 'neutral' | 'warning' | 'danger'> = {
  waiting: 'neutral',
  sending: 'warning',
  failed: 'danger',
}

/**
 * The changes that have not reached the server yet, and what is happening to
 * each of them.
 *
 * The countdown to the next attempt is the whole point. A queue that says
 * "failed" with a retry button makes every reader press it immediately, which
 * is exactly what a backoff exists to prevent; showing the backoff turns
 * waiting into something visible rather than something suspicious.
 *
 * Failures are separated into ones that will be retried and ones that will not.
 * A change that has run out of attempts needs a decision, not another spinner,
 * so it loses the countdown and gains a discard.
 *
 * Labels are the reader's words, not the endpoint's. "Change your daily limit"
 * is a queue entry someone can act on; `PATCH /accounts/:id/limits` is not.
 */
export function RetryQueue({
  items,
  label,
  onRetry,
  onDiscard,
  onRetryAll,
  emptyLabel = 'Everything is saved.',
  className,
}: RetryQueueProps) {
  // One timer for the whole list, ticking every countdown at once.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!items.some((item) => item.nextAttemptIn !== undefined)) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [items])

  const failed = items.filter((item) => item.state === 'failed').length

  if (items.length === 0) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <StatusDot tone="success" label="All saved" />
        <Text size="caption" tone="soft">
          {emptyLabel}
        </Text>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Text size="caption" weight="bold">
          {items.length} {items.length === 1 ? 'change' : 'changes'} waiting
          {failed > 0 ? `, ${failed} failed` : ''}
        </Text>
        {onRetryAll && failed > 0 && (
          <button
            type="button"
            onClick={onRetryAll}
            className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Try all now
          </button>
        )}
      </div>

      <ul aria-label={label} className="flex flex-col gap-1.5">
        {items.map((item) => {
          const remaining = Math.max(0, (item.nextAttemptIn ?? 0) - tick)
          return (
            <li
              key={item.id}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-tile)] border px-3 py-2.5',
                item.state === 'failed' ? 'border-danger/30 bg-danger/[0.06]' : 'border-line bg-surface',
              )}
            >
              {item.state === 'sending' ? (
                <Spinner size="sm" />
              ) : (
                <StatusDot tone={TONE[item.state]} label={item.state} />
              )}

              <span className="flex min-w-0 flex-1 flex-col">
                <Text as="span" size="body" truncate>
                  {item.label}
                </Text>
                {(item.detail || item.error) && (
                  <Text
                    as="span"
                    size="caption"
                    tone={item.error ? 'danger' : 'faint'}
                    leading="normal"
                  >
                    {item.error ?? item.detail}
                  </Text>
                )}
              </span>

              {item.attempts !== undefined && item.attempts > 0 && (
                <Text as="span" size="micro" tone="faint" tabular>
                  {item.attempts} {item.attempts === 1 ? 'try' : 'tries'}
                </Text>
              )}

              {/* A backoff shown is a backoff people stop fighting. */}
              {!item.terminal && item.nextAttemptIn !== undefined && item.state !== 'sending' && (
                <Text as="span" size="micro" tone="soft" tabular>
                  retrying in {countdown(remaining)}
                </Text>
              )}

              <span className="flex shrink-0 items-center gap-2">
                {onRetry && item.state !== 'sending' && (
                  <button
                    type="button"
                    onClick={() => onRetry(item.id)}
                    className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
                  >
                    Retry
                  </button>
                )}
                {onDiscard && (
                  <button
                    type="button"
                    onClick={() => onDiscard(item.id)}
                    className="rounded-full px-1 text-[11px] font-bold text-ink-faint underline underline-offset-2 hover:text-danger"
                  >
                    Discard
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <VisuallyHidden>
        <p role="status" aria-live="polite">
          {failed > 0
            ? `${failed} of ${items.length} changes failed to send.`
            : `${items.length} changes waiting to send.`}
        </p>
      </VisuallyHidden>
    </div>
  )
}
