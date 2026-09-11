'use client'

import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

export interface RelativeTimeProps {
  /** The moment — a Date, a timestamp in milliseconds, or an ISO string. */
  date: Date | number | string
  /** Locale for the phrasing. Defaults to the browser's. */
  locale?: string
  /** long: "3 minutes ago". short: "3 min. ago". narrow: "3m ago". */
  unitStyle?: 'long' | 'short' | 'narrow'
  /** Keep the phrase current as time passes. */
  live?: boolean
  /** Merged last, so it wins. */
  className?: string
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

function phrase(
  target: number,
  now: number,
  locale: string | undefined,
  style: RelativeTimeProps['unitStyle'],
) {
  const seconds = Math.round((target - now) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style })

  // Under 45 seconds is "now": counting seconds up is noise, not information.
  if (Math.abs(seconds) < 45) return formatter.format(0, 'second')
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return formatter.format(Math.round(seconds / 60), 'minute')
}

/**
 * "3 minutes ago", phrased by the platform and kept current.
 *
 * It renders a real <time> with the exact moment in `dateTime` and the full
 * date on hover, so the phrase is a convenience and the precise value is never
 * lost. Wording comes from Intl.RelativeTimeFormat, so it is correct in every
 * locale the browser knows — including "yesterday" and "next week". It re-renders
 * every thirty seconds within the hour and hourly after that, not every second.
 */
export function RelativeTime({
  date,
  locale,
  unitStyle = 'long',
  live = true,
  className,
}: RelativeTimeProps) {
  const target = new Date(date).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!live || Number.isNaN(target)) return
    const distance = Math.abs(target - now) / 1000
    const delay = distance < 3_600 ? 30_000 : 3_600_000
    const timer = window.setTimeout(() => setNow(Date.now()), delay)
    return () => window.clearTimeout(timer)
  }, [live, target, now])

  if (Number.isNaN(target)) return null

  return (
    <time
      dateTime={new Date(target).toISOString()}
      title={new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
        target,
      )}
      // The phrase depends on the clock, so a server render and the first
      // client render can legitimately differ by a minute.
      suppressHydrationWarning
      className={cn('tabular-nums', className)}
    >
      {phrase(target, now, locale, unitStyle)}
    </time>
  )
}
