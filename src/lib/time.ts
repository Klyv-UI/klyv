'use client'

import { useEffect, useState } from 'react'

/**
 * Relative time, shared by the components in this set that show one.
 *
 * The wording is deliberately coarse. "3 minutes ago" and "2 hours ago" are
 * what a reader acts on; "3 minutes and 12 seconds ago" is noise that also
 * forces a re-render every second for nothing.
 */
export function relativeTime(from: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - from.getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  return from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** "1:59", for a countdown that has to be read at a glance. */
export function countdown(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  if (safe >= 3600) {
    const hours = Math.floor(safe / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * A clock that ticks only as often as the displayed value can change.
 *
 * A relative time under a minute changes every ten seconds; past that, once a
 * minute is enough. Ticking every second regardless is the usual approach and
 * it re-renders sixty times to change the text once.
 */
export function useRelativeClock(since: Date | undefined, active = true): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!since || !active) return
    const age = Date.now() - since.getTime()
    const period = age < 60_000 ? 10_000 : 60_000
    const timer = window.setInterval(() => setNow(new Date()), period)
    return () => window.clearInterval(timer)
    // `now` is a dependency on purpose: crossing a minute re-picks the period.
  }, [active, since, now])

  return now
}
