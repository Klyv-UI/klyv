'use client'

import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import { relativeTime, useRelativeClock } from '../../lib/time'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface SaveIndicatorProps {
  state: SaveState
  /** When the last successful save landed. Shown as a live relative time. */
  lastSavedAt?: Date
  /** Save now — offered while there are unsaved changes. */
  onSaveNow?: () => void
  /** Try again after a failure. */
  onRetry?: () => void
  /** Why it failed. Shown verbatim, so keep it in the reader's language. */
  error?: string
  /** Drop the relative time and the actions. */
  compact?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * What autosave is doing, and when it last succeeded.
 *
 * "Saved" on its own is the least useful thing this can say, because it is
 * indistinguishable from "saved four hours ago, and nothing since". The
 * timestamp is what makes it a claim rather than a reassurance, and it ticks —
 * at the rate the wording can actually change, not once a second.
 *
 * Failure is the state that matters and the one usually rendered as a red dot.
 * Here it keeps the reader's last successful save on screen beside the error,
 * so the question they are about to ask — how much did I lose — is already
 * answered.
 *
 * Only errors interrupt. The live region is polite for every other state,
 * because a save indicator announcing itself on every keystroke pause makes a
 * screen reader unusable.
 */
export function SaveIndicator({
  state,
  lastSavedAt,
  onSaveNow,
  onRetry,
  error,
  compact = false,
  className,
}: SaveIndicatorProps) {
  const now = useRelativeClock(lastSavedAt, state !== 'saving')

  const wording: Record<SaveState, string> = {
    idle: lastSavedAt ? 'Saved' : 'Nothing to save yet',
    dirty: 'Unsaved changes',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Could not save',
  }

  const tone: Record<SaveState, 'neutral' | 'warning' | 'success' | 'danger'> = {
    idle: 'neutral',
    dirty: 'warning',
    saving: 'warning',
    saved: 'success',
    error: 'danger',
  }

  return (
    <div
      role="status"
      // Polite for everything, assertive only when something is actually wrong.
      aria-live={state === 'error' ? 'assertive' : 'polite'}
      className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1', className)}
    >
      {state === 'saving' ? <Spinner size="sm" /> : <StatusDot tone={tone[state]} label={wording[state]} />}

      <Text as="span" size="caption" weight="bold" tone={state === 'error' ? 'danger' : 'default'}>
        {wording[state]}
      </Text>

      {/* Kept beside the failure on purpose: "how much did I lose" is the
          next question, and it should already be answered. */}
      {!compact && lastSavedAt && state !== 'saving' && (
        <Text as="span" size="caption" tone="faint">
          {state === 'error' ? 'last saved ' : ''}
          {relativeTime(lastSavedAt, now)}
        </Text>
      )}

      {!compact && state === 'error' && error && (
        <Text as="span" size="caption" tone="soft">
          {error}
        </Text>
      )}

      {!compact && state === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full px-1 text-[11px] font-bold text-ink underline underline-offset-2"
        >
          Try again
        </button>
      )}

      {!compact && state === 'dirty' && onSaveNow && (
        <button
          type="button"
          onClick={onSaveNow}
          className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          Save now
        </button>
      )}
    </div>
  )
}
