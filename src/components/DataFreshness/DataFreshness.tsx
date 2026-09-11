'use client'

import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'
import { StatusDot } from '../StatusDot'
import { Text } from '../Text'
import { relativeTime, useRelativeClock } from '../../lib/time'

export interface DataFreshnessProps {
  /** When this data was fetched. Not when the page rendered. */
  updatedAt?: Date
  /** Milliseconds after which it should be treated as stale. */
  staleAfter?: number
  /** A refresh is in flight. */
  loading?: boolean
  onRefresh?: () => void
  /** What the data is, for the announcement. */
  label?: string
  /** The last refresh failed, and this is still the old data. */
  error?: string
  /** Merged last, so it wins. */
  className?: string
}

/**
 * When this data was last true, and whether that is still good enough.
 *
 * A dashboard with no timestamp is asking to be trusted about something it has
 * not said. The number on screen is always from some moment in the past, and
 * the only honest question is how far past — so the answer belongs beside it,
 * not in a tooltip.
 *
 * Staleness is a threshold the caller sets, because it is a domain judgement
 * rather than a UI one. Ninety seconds is ancient for an authorisation rate and
 * perfectly current for a monthly statement.
 *
 * A failed refresh keeps the old timestamp rather than replacing it with an
 * error. The data on screen did not become wrong because the network did — it
 * became *older*, and saying exactly how old is the useful thing to say.
 */
export function DataFreshness({
  updatedAt,
  staleAfter = 5 * 60_000,
  loading = false,
  onRefresh,
  label = 'This data',
  error,
  className,
}: DataFreshnessProps) {
  const now = useRelativeClock(updatedAt, !loading)
  const age = updatedAt ? now.getTime() - updatedAt.getTime() : Infinity
  const stale = age > staleAfter

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : (
        <StatusDot
          tone={error ? 'danger' : stale ? 'warning' : 'success'}
          label={error ? 'Refresh failed' : stale ? 'Out of date' : 'Up to date'}
        />
      )}

      <Text as="span" size="caption" tone={stale || error ? 'default' : 'faint'}>
        {loading
          ? 'Refreshing…'
          : updatedAt
            ? `${label} was updated ${relativeTime(updatedAt, now)}`
            : `${label} has not loaded yet`}
      </Text>

      {/* Old, not wrong — and the age is the part worth stating. */}
      {error && !loading && (
        <Text as="span" size="caption" tone="danger">
          {error}
        </Text>
      )}

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-40"
        >
          Refresh
        </button>
      )}
    </div>
  )
}
