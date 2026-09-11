'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Spinner } from '../Spinner'
import { Text } from '../Text'
import { countdown } from '../../lib/time'

export interface ConnectionBannerProps {
  /** Override the browser's own reading — useful when your API is the thing that is down. */
  online?: boolean
  /** Changes waiting to be sent. Shown even once the connection returns. */
  queued?: number
  /** Seconds until the next automatic attempt. Counts down locally. */
  retryIn?: number
  /** A reconnection attempt is in flight. */
  retrying?: boolean
  /** Called when the retry action is pressed. */
  onRetry?: () => void
  /** Milliseconds to keep "back online" on screen before it goes. */
  restoredFor?: number
  /** Pin to the top of the viewport rather than sitting in the flow. */
  fixed?: boolean
  /** Merged last, so it wins. */
  className?: string
}

/**
 * The strip that says the connection is gone, what is waiting, and when the
 * next attempt is.
 *
 * `navigator.onLine` only knows whether there is a network interface, not
 * whether the API answers — a captive portal and a dead backend both read as
 * online. So the browser's value is the default and `online` overrides it, which
 * lets a failing request drive the banner instead of a lie about the wifi.
 *
 * It also stays for a moment after the connection returns. Vanishing the instant
 * things recover leaves the reader unsure whether it ever really came back, and
 * whether the thing they typed went anywhere — so "back online" is stated, held
 * briefly, and then removed.
 *
 * The queue count is the part that matters most and the part usually missing:
 * "offline" alone does not say whether the last three edits are safe.
 */
export function ConnectionBanner({
  online,
  queued = 0,
  retryIn,
  retrying = false,
  onRetry,
  restoredFor = 4000,
  fixed = false,
  className,
}: ConnectionBannerProps) {
  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  )
  const [restored, setRestored] = useState(false)
  const [seconds, setSeconds] = useState(retryIn ?? 0)
  const wasOffline = useRef(false)

  const connected = online ?? browserOnline

  useEffect(() => {
    const up = () => setBrowserOnline(true)
    const down = () => setBrowserOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Hold "back online" briefly, so a recovery is something the reader sees.
  useEffect(() => {
    if (!connected) {
      wasOffline.current = true
      setRestored(false)
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    setRestored(true)
    const timer = window.setTimeout(() => setRestored(false), restoredFor)
    return () => window.clearTimeout(timer)
  }, [connected, restoredFor])

  useEffect(() => {
    setSeconds(retryIn ?? 0)
    if (retryIn === undefined || connected) return
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [connected, retryIn])

  const showing = !connected || restored || (connected && queued > 0)
  if (!showing) return null

  const tone = !connected
    ? 'border-warning/40 bg-warning/12 text-ink'
    : restored
      ? 'border-success/40 bg-success/10 text-ink'
      : 'border-line bg-surface-muted text-ink'

  const message = !connected
    ? 'You are offline.'
    : restored
      ? 'Back online.'
      : 'Sending your changes.'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-2.5',
        fixed
          ? 'fixed inset-x-0 top-0 z-[var(--z-sticky)] border-x-0 border-t-0'
          : 'rounded-[var(--radius-tile)]',
        tone,
        className,
      )}
    >
      {(retrying || (connected && queued > 0)) && <Spinner size="sm" />}

      <Text as="span" size="body">
        {message}
      </Text>

      {queued > 0 && (
        <Text as="span" size="caption" weight="medium" tone="soft">
          {queued} {queued === 1 ? 'change is' : 'changes are'} waiting. Nothing has been lost.
        </Text>
      )}

      {!connected && retryIn !== undefined && !retrying && (
        <Text as="span" size="caption" tone="soft" tabular>
          Next attempt in {countdown(seconds)}
        </Text>
      )}

      {onRetry && !connected && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="ml-auto rounded-full px-1 text-[12px] font-bold underline underline-offset-2 disabled:opacity-40"
        >
          Try now
        </button>
      )}
    </div>
  )
}
