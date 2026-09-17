'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useOverlayLayer } from '../../lib/overlay'
import { Button } from '../Button'
import { ProgressRing } from '../ProgressRing'
import { Text } from '../Text'
import { FocusTrap } from '../FocusTrap'
import { Portal } from '../Portal'
import { countdown } from '../../lib/time'

export interface SessionTimeoutProps {
  /** Milliseconds of inactivity before the session ends. */
  timeout?: number
  /** Milliseconds before the end at which to warn. */
  warnAt?: number
  /** Extend the session. Await it, and the dialog stays until it settles. */
  onExtend: () => void | Promise<void>
  /** The session has ended. Sign the person out here. */
  onExpire: () => void
  /** localStorage key used to share activity between tabs. Empty disables it. */
  syncKey?: string
  /** Heading for the warning dialog. */
  title?: string
  /** Suspend the whole thing — while a payment is being confirmed, say. */
  paused?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * The warning before an idle session ends, with a countdown and a way to stay.
 *
 * Activity is shared between tabs through `localStorage`. Without that, a second
 * tab left open on a dashboard counts as idle and signs the person out of the
 * one they are actually typing in — the single most common complaint about
 * session timeouts, and it is a five-line fix.
 *
 * The deadline is a timestamp, not a countdown that ticks down. Timers are
 * throttled in background tabs and stop entirely when a laptop sleeps, so
 * anything counting frames or intervals wakes up believing minutes were
 * seconds. Comparing against a stored expiry survives both.
 *
 * The warning is a real dialog: focus is trapped and restored, and it does not
 * close on Escape or on a click outside, because dismissing it by reflex is
 * indistinguishable from choosing to be signed out.
 */
export function SessionTimeout({
  timeout = 15 * 60_000,
  warnAt = 60_000,
  onExtend,
  onExpire,
  syncKey = 'klyv:last-activity',
  title = 'Still there?',
  paused = false,
  className,
}: SessionTimeoutProps) {
  const [remaining, setRemaining] = useState(timeout)
  const [extending, setExtending] = useState(false)
  const expiresAt = useRef(Date.now() + timeout)
  const expired = useRef(false)

  const push = useCallback(
    (broadcast: boolean) => {
      expiresAt.current = Date.now() + timeout
      expired.current = false
      if (broadcast && syncKey) {
        try {
          window.localStorage.setItem(syncKey, String(Date.now()))
        } catch {
          // Private mode, or storage disabled. The single-tab path still works.
        }
      }
    },
    [syncKey, timeout],
  )

  // Local activity, and the same activity arriving from another tab.
  useEffect(() => {
    if (paused) return
    const onActivity = () => {
      // While the warning is up, only the button counts — otherwise the click
      // that dismisses nothing would silently extend the session.
      if (expiresAt.current - Date.now() <= warnAt) return
      push(true)
    }
    for (const event of ACTIVITY) window.addEventListener(event, onActivity, { passive: true })

    const onStorage = (event: StorageEvent) => {
      if (event.key === syncKey) push(false)
    }
    window.addEventListener('storage', onStorage)

    return () => {
      for (const event of ACTIVITY) window.removeEventListener(event, onActivity)
      window.removeEventListener('storage', onStorage)
    }
  }, [paused, push, syncKey, warnAt])

  // Compared against a timestamp, so a sleeping laptop cannot cheat it.
  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      const left = expiresAt.current - Date.now()
      setRemaining(left)
      if (left <= 0 && !expired.current) {
        expired.current = true
        onExpire()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [onExpire, paused])

  const warning = !paused && remaining <= warnAt && remaining > 0

  // On the stack like every other dialog, so it takes the front layer when it
  // interrupts one that is already open. Not dismissible: see above.
  const { zIndex } = useOverlayLayer({ open: warning, dismissible: false })

  if (!warning) return null

  const seconds = Math.max(0, Math.round(remaining / 1000))

  const extend = async () => {
    setExtending(true)
    try {
      await onExtend()
      push(true)
      setRemaining(timeout)
    } finally {
      setExtending(false)
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
        <div aria-hidden="true" className="absolute inset-0 bg-scrim backdrop-blur-[2px]" />
        <FocusTrap className="relative w-full max-w-[400px]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-timeout-title"
            aria-describedby="session-timeout-body"
            className={cn(
              'flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center shadow-[var(--shadow-window)]',
              className,
            )}
          >
            <ProgressRing
              value={(seconds / (warnAt / 1000)) * 100}
              label="Time left in this session"
              size="lg"
            >
              <Text size="stat" tabular>
                {countdown(seconds)}
              </Text>
            </ProgressRing>

            <div className="flex flex-col gap-1.5">
              <Text as="h2" id="session-timeout-title" size="subtitle">
                {title}
              </Text>
              <Text id="session-timeout-body" size="body" weight="medium" tone="soft" leading="normal">
                You will be signed out in {countdown(seconds)} for your security. Anything you have
                typed is kept.
              </Text>
            </div>

            <div className="flex w-full flex-col gap-2">
              <Button fullWidth loading={extending} onClick={() => void extend()}>
                Stay signed in
              </Button>
              <Button fullWidth variant="ghost" onClick={onExpire}>
                Sign out now
              </Button>
            </div>
          </div>
        </FocusTrap>
      </div>
    </Portal>
  )
}
