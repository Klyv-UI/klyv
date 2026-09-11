'use client'

import { useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ProgressRing } from '../ProgressRing'
import { Spinner } from '../Spinner'
import { Text } from '../Text'

export interface PullToRefreshProps {
  /** The scrollable content. */
  children: ReactNode
  /** Run the refresh. Await it, and the indicator stays until it settles. */
  onRefresh: () => void | Promise<void>
  /** Pixels the content must travel before the release counts. */
  threshold?: number
  /** Height of the scrolling area. It must scroll for the gesture to make sense. */
  className?: string
  /** Copy shown at each stage. */
  labels?: { pull?: string; release?: string; refreshing?: string }
  /** Render a real Refresh button above the list. Turn it off at your peril. */
  showButton?: boolean
  /** Blocks interaction and dims the control. */
  disabled?: boolean
}

/** Past the threshold the pull gets heavier, so the edge feels elastic. */
function resist(distance: number, threshold: number): number {
  if (distance <= threshold) return distance
  return threshold + (distance - threshold) * 0.35
}

/**
 * Drag the top of a list down past a threshold to reload it.
 *
 * The gesture only starts when the container is already scrolled to the top,
 * which is the rule that keeps it from stealing an ordinary scroll — the
 * common failure of hand-rolled versions, where flicking up mid-list snaps you
 * to a refresh. Past the threshold the travel is damped rather than clamped, so
 * the edge feels elastic instead of stuck.
 *
 * The indicator tracks the pull as a fraction, so the ring is full at exactly
 * the point release would fire; nothing has to be guessed. `onRefresh` may
 * return a promise, and the spinner stays until it settles rather than for an
 * arbitrary timeout.
 *
 * There is always a real Refresh button. A drag is a pointer gesture with no
 * keyboard equivalent, and a list that can only be reloaded by dragging cannot
 * be reloaded by everyone.
 */
export function PullToRefresh({
  children,
  onRefresh,
  threshold = 72,
  className,
  labels,
  showButton = true,
  disabled = false,
}: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const copy = {
    pull: labels?.pull ?? 'Pull to refresh',
    release: labels?.release ?? 'Release to refresh',
    refreshing: labels?.refreshing ?? 'Refreshing…',
  }

  const armed = pull >= threshold
  const progress = Math.min(1, pull / threshold)

  const run = async () => {
    if (refreshing) return
    setRefreshing(true)
    setPull(0)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || refreshing) return
    // Only from the very top: anywhere else this is an ordinary scroll.
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return
    start.current = event.clientY
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return
    const distance = event.clientY - start.current
    if (distance <= 0) {
      setPull(0)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPull(resist(distance, threshold))
  }

  const onPointerUp = () => {
    if (start.current === null) return
    start.current = null
    if (armed) void run()
    else setPull(0)
  }

  return (
    <div className="relative isolate flex flex-col gap-2">
      {showButton && (
        <button
          type="button"
          onClick={() => void run()}
          disabled={disabled || refreshing}
          className="self-start rounded-full px-1 text-[11px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-40"
        >
          Refresh
        </button>
      )}

      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {/* The indicator sits behind the content and is uncovered by the pull. */}
        <div
          aria-hidden={!refreshing && pull === 0}
          className="absolute inset-x-0 top-0 flex items-center justify-center gap-2"
          style={{ height: Math.max(pull, refreshing ? threshold * 0.7 : 0) }}
        >
          {refreshing ? (
            <Spinner size="sm" />
          ) : (
            <ProgressRing value={progress * 100} size="sm" label="Pull progress" />
          )}
          <Text size="caption" weight="bold" tone={armed || refreshing ? 'default' : 'faint'}>
            {refreshing ? copy.refreshing : armed ? copy.release : copy.pull}
          </Text>
        </div>

        <div
          ref={scrollRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            // select-none: a vertical drag over text otherwise selects it,
            // and the selection highlight makes the pull look broken.
            'relative select-none overflow-y-auto bg-surface',
            start.current === null &&
              'motion-safe-only transition-transform duration-[var(--duration-slow)] ease-[cubic-bezier(0.32,0.72,0,1)]',
            className,
          )}
          style={{
            transform: `translate3d(0, ${refreshing ? threshold * 0.7 : pull}px, 0)`,
          }}
        >
          {children}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {refreshing ? copy.refreshing : ''}
      </p>
    </div>
  )
}
