'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ArrowRightIcon, CrossIcon } from '../internal/icons'

export type AnnouncementTone = 'accent' | 'ink' | 'muted'

const TONES: Record<AnnouncementTone, string> = {
  accent: 'bg-accent text-accent-ink',
  ink: 'bg-ink text-ink-inverse',
  muted: 'bg-surface-muted text-ink',
}

export interface AnnouncementBarProps {
  /** One sentence. */
  children: ReactNode
  /** Short qualifier in front — "New". */
  badge?: string
  href?: string
  linkLabel?: string
  tone?: AnnouncementTone
  onDismiss?: () => void
  /** Remember the dismissal in this browser under this key. Change the key for the next announcement. */
  storageKey?: string
  className?: string
}

function readDismissed(key?: string) {
  if (!key) return false
  try {
    return window.localStorage.getItem(key) === 'dismissed'
  } catch {
    return false
  }
}

/**
 * The thin strip across the very top of a site or app: a launch, a webinar,
 * scheduled maintenance.
 *
 * Dismissal is remembered per announcement, not globally — keyed by the caller
 * — so closing last month's launch does not also hide next week's outage
 * notice. Storage failing (private windows, blocked site data) just means it
 * shows again, never an error.
 */
export function AnnouncementBar({
  children,
  badge,
  href,
  linkLabel = 'Learn more',
  tone = 'ink',
  onDismiss,
  storageKey,
  className,
}: AnnouncementBarProps) {
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey))
  if (dismissed) return null

  const dismissible = Boolean(onDismiss || storageKey)

  const dismiss = () => {
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, 'dismissed')
      } catch {
        // Not remembered; it will simply come back next visit.
      }
    }
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      role="region"
      aria-label="Announcement"
      className={cn('relative flex min-h-10 items-center justify-center px-12 py-2', TONES[tone], className)}
    >
      <p className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-center text-[12px] font-semibold leading-snug">
        {badge && (
          <span className="rounded-full bg-current/15 px-2 py-[3px] text-[10px] font-bold leading-none">{badge}</span>
        )}
        <span>{children}</span>
        {href && (
          <a href={href} className="group inline-flex items-center gap-1 font-bold underline underline-offset-2">
            {linkLabel}
            <ArrowRightIcon size={11} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        )}
      </p>
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={dismiss}
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
        >
          <CrossIcon size={12} />
        </button>
      )}
    </div>
  )
}
