'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { IconButton } from '../IconButton'
import { Text } from '../Text'
import { CrossIcon } from '../internal/icons'

export type MaintenanceNoticeImpact = 'none' | 'degraded' | 'outage'
export type MaintenanceNoticePhase = 'upcoming' | 'in-progress' | 'completed'

const IMPACT: Record<MaintenanceNoticeImpact, string> = {
  none: 'No downtime expected',
  degraded: 'Some features may be slow or read-only',
  outage: 'The service will be unavailable',
}

const PHASE_TONE: Record<MaintenanceNoticePhase, string> = {
  upcoming: 'border-line bg-surface-muted',
  'in-progress': 'border-warning/40 bg-warning/12',
  completed: 'border-success/40 bg-success/10',
}

export interface MaintenanceNoticeProps {
  /** When the window opens. */
  start: Date
  /** When the window is expected to close. */
  end: Date
  /** What is being worked on — "Database upgrade". */
  title?: string
  /** Extra detail: what to expect, what to do beforehand. */
  description?: ReactNode
  /** How much readers will notice. Drives the impact line. */
  impact?: MaintenanceNoticeImpact
  /** A status page with live updates. */
  statusHref?: string
  /** Label on the status link. */
  statusLabel?: string
  /**
   * Remember a dismissal in this browser. The window's start time is added to the key, so dismissing this
   * window never hides the next one. Reads and writes are guarded.
   */
  storageKey?: string
  /** Called when the notice is dismissed. Leave both this and storageKey out to make it permanent. */
  onDismiss?: () => void
  /** Milliseconds to keep saying "completed" after the window ends, before the notice goes. */
  completedFor?: number
  /** The current time. Leave it out to follow the clock; pass it to pin a phase in a test or a demo. */
  now?: Date
  /** IANA time zone for the window. Defaults to the reader’s own. */
  timeZone?: string
  /** Merged last, so it wins. */
  className?: string
}

function storageId(key: string, start: Date) {
  return `${key}:${start.getTime()}`
}

function readDismissed(key: string | undefined, start: Date) {
  if (!key) return false
  try {
    return window.localStorage.getItem(storageId(key, start)) === 'dismissed'
  } catch {
    return false
  }
}

/** "2h 15m", "4m", "under a minute" — coarse on purpose; the exact time is shown beside it. */
function span(ms: number) {
  const minutes = Math.ceil(ms / 60_000)
  if (minutes <= 1) return 'under a minute'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return rest ? `${hours}h ${rest}m` : `${hours}h`
  return `${rest}m`
}

function formatWindow(start: Date, end: Date, timeZone?: string) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }
  const format = new Intl.DateTimeFormat(undefined, options) as Intl.DateTimeFormat & {
    formatRange?: (from: Date, to: Date) => string
  }
  try {
    if (format.formatRange) return format.formatRange(start, end)
  } catch {
    // Fall through to two formatted ends.
  }
  return `${format.format(start)} – ${format.format(end)}`
}

/**
 * The banner that warns about planned downtime before it happens, says so while
 * it is happening, and confirms when it is over.
 *
 * The window is written in the reader's own time zone, with the zone named,
 * because "02:00 UTC" makes every reader do arithmetic and some get it wrong. A
 * relative countdown sits beside it, since "in 3 hours" is what decides whether
 * to save now.
 *
 * The phase follows the clock rather than a prop, so a notice deployed a week
 * ahead turns into "in progress" and then "completed" by itself. Dismissal is
 * stored per window — the start time is part of the key — so closing this
 * month's notice does not silence next month's.
 */
export function MaintenanceNotice({
  start,
  end,
  title = 'Scheduled maintenance',
  description,
  impact = 'degraded',
  statusHref,
  statusLabel = 'Status page',
  storageKey,
  onDismiss,
  completedFor = 3_600_000,
  now: fixedNow,
  timeZone,
  className,
}: MaintenanceNoticeProps) {
  const [clock, setClock] = useState(() => Date.now())
  const [dismissed, setDismissed] = useState(false)

  const startTime = start.getTime()
  useEffect(() => {
    if (readDismissed(storageKey, new Date(startTime))) setDismissed(true)
  }, [storageKey, startTime])

  const now = fixedNow?.getTime() ?? clock
  const phase: MaintenanceNoticePhase = now < start.getTime() ? 'upcoming' : now < end.getTime() ? 'in-progress' : 'completed'
  const next = phase === 'upcoming' ? start.getTime() : phase === 'in-progress' ? end.getTime() : end.getTime() + completedFor

  // Tick each second in the last hour before a boundary, and every half minute before that.
  useEffect(() => {
    if (fixedNow || clock >= next) return
    const every = next - clock <= 3_600_000 ? 1000 : 30_000
    const timer = window.setTimeout(() => setClock(Date.now()), every)
    return () => window.clearTimeout(timer)
  }, [fixedNow, next, clock])

  if (dismissed || (phase === 'completed' && now >= end.getTime() + completedFor)) return null

  const dismissible = Boolean(storageKey || onDismiss)
  const dismiss = () => {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageId(storageKey, start), 'dismissed')
      } catch {
        // Not remembered; it will come back on the next visit.
      }
    }
    setDismissed(true)
    onDismiss?.()
  }

  const heading =
    phase === 'upcoming' ? title : phase === 'in-progress' ? `${title} in progress` : `${title} completed`
  const relative =
    phase === 'upcoming'
      ? `Starts in ${span(start.getTime() - now)}`
      : phase === 'in-progress'
        ? `Expected to end in ${span(end.getTime() - now)}`
        : 'Everything is running normally again.'

  return (
    <div
      className={cn(
        'relative flex flex-wrap items-start gap-x-4 gap-y-2 rounded-[var(--radius-tile)] border px-4 py-3 text-ink',
        PHASE_TONE[phase],
        dismissible && 'pr-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-1 size-2.5 shrink-0 rounded-full',
          phase === 'upcoming' && 'bg-ink-faint',
          phase === 'in-progress' && 'bg-warning',
          phase === 'completed' && 'bg-success',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Only the phase is live: the countdown changes every second and would talk over the page. */}
        <Text role="status" aria-live="polite" size="body" weight="bold">
          {heading}
        </Text>
        <Text size="label" tone="soft" leading="normal">
          <time dateTime={start.toISOString()}>{formatWindow(start, end, timeZone)}</time>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">{relative}</span>
        </Text>
        {phase !== 'completed' && (
          <Text size="label" weight="semibold" leading="normal">
            {IMPACT[impact]}
          </Text>
        )}
        {description && phase !== 'completed' && (
          <Text size="label" tone="soft" leading="normal">
            {description}
          </Text>
        )}
      </div>
      {statusHref && (
        <a
          href={statusHref}
          className="self-center rounded-full px-1 text-[12px] font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {statusLabel}
        </a>
      )}
      {dismissible && (
        <IconButton
          icon={CrossIcon}
          label="Dismiss maintenance notice"
          size="xs"
          onClick={dismiss}
          className="absolute right-2 top-2"
        />
      )}
    </div>
  )
}
