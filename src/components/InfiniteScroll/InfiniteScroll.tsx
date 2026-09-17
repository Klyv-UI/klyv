'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Spinner } from '../Spinner'
import { Text } from '../Text'

export type InfiniteScrollMode = 'auto' | 'button'

export interface InfiniteScrollProps {
  /** The list so far. InfiniteScroll adds nothing around it but the footer. */
  children: ReactNode
  /** Fetch the next page. Resolve with how many items arrived, so the count can be announced; reject to show the error. */
  onLoadMore: () => Promise<number | void>
  /** Whether there is anything left to load. When false the footer says so. */
  hasMore: boolean
  /** `auto` loads when the end scrolls into view and keeps the button as a fallback; `button` loads only on request. */
  mode?: InfiniteScrollMode
  /** How far ahead of the end to start loading, as an IntersectionObserver root margin. */
  rootMargin?: string
  /** What the items are, for announcements — "3 more results loaded". Singular form. */
  itemNoun?: string
  /** Label on the load button. */
  loadMoreLabel?: string
  /** Shown once `hasMore` is false. Pass null to show nothing. */
  endMessage?: ReactNode
  /** Merged onto the wrapper. */
  className?: string
}

type Status = 'idle' | 'loading' | 'error'

/**
 * A list that fetches its next page when the reader reaches the end.
 *
 * Pure scroll-triggered loading has three known failures: a keyboard or
 * switch user may never "reach" a sentinel, a screen reader hears nothing
 * when items appear, and a footer below the list becomes unreachable. So the
 * sentinel is only a shortcut — a real "Load more" button is always there,
 * and in `button` mode it is the only trigger. New items are announced with
 * their count, a failure shows its reason with a retry that does not
 * auto-fire again, and the end of the list is stated rather than implied.
 *
 * The button is never disabled while loading, only marked busy, because
 * disabling a focused button drops focus to the page body and a keyboard
 * reader would have to find their place again.
 */
export function InfiniteScroll({
  children,
  onLoadMore,
  hasMore,
  mode = 'auto',
  rootMargin = '200px',
  itemNoun = 'item',
  loadMoreLabel = 'Load more',
  endMessage = 'You’ve reached the end',
  className,
}: InfiniteScrollProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [round, setRound] = useState(0)
  const busy = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLParagraphElement>(null)
  const loadRef = useRef<() => void>(() => {})
  const buttonHadFocus = useRef(false)

  const load = async () => {
    if (busy.current || !hasMore) return
    busy.current = true
    buttonHadFocus.current = document.activeElement?.hasAttribute('data-infinite-load') ?? false
    setStatus('loading')
    setError(null)
    setAnnouncement(`Loading more ${itemNoun}s`)
    try {
      const count = await onLoadMore()
      setStatus('idle')
      setAnnouncement(
        typeof count === 'number'
          ? count === 0
            ? `No more ${itemNoun}s`
            : `${count} more ${count === 1 ? itemNoun : `${itemNoun}s`} loaded`
          : `More ${itemNoun}s loaded`,
      )
    } catch (reason) {
      setStatus('error')
      setError(reason instanceof Error ? reason.message : 'Could not load more.')
      setAnnouncement(`Loading failed`)
    } finally {
      busy.current = false
      // Re-observing makes the observer report again, so a sentinel that is
      // still on screen after a short page keeps the list filling.
      setRound((value) => value + 1)
    }
  }
  loadRef.current = load

  // The button that had focus disappears at the end of the list; hand focus to
  // the message that replaced it instead of letting it fall to the body.
  useEffect(() => {
    if (hasMore || !buttonHadFocus.current) return
    buttonHadFocus.current = false
    const active = document.activeElement
    if ((!active || active === document.body) && endRef.current) endRef.current.focus()
  }, [hasMore])

  useEffect(() => {
    const node = sentinelRef.current
    if (mode !== 'auto' || !hasMore || status !== 'idle' || !node) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadRef.current()
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [mode, hasMore, status, rootMargin, round])

  const loading = status === 'loading'

  return (
    <div className={cn('flex flex-col', className)}>
      <div aria-busy={loading || undefined}>{children}</div>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div className="flex flex-col items-center gap-2 py-4">
        {hasMore ? (
          <>
            {status === 'error' && (
              <Text size="label" tone="danger" weight="semibold">
                {error}
              </Text>
            )}
            <Button
              variant="outline"
              size="sm"
              aria-disabled={loading || undefined}
              aria-busy={loading || undefined}
              onClick={() => void load()}
              data-infinite-load=""
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Loading…' : status === 'error' ? 'Try again' : loadMoreLabel}
            </Button>
          </>
        ) : (
          endMessage !== null && (
            <p ref={endRef} tabIndex={-1} className="text-[12px] font-medium text-ink-faint outline-none">
              {endMessage}
            </p>
          )
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
